import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

function getMethodBody(source: string, methodSignature: string): string {
  const start = source.indexOf(methodSignature);
  assert.notEqual(start, -1, `Could not find method: ${methodSignature}`);

  const parameterEnd = source.indexOf(")", start);
  assert.notEqual(parameterEnd, -1, `Could not find method parameters: ${methodSignature}`);

  let bodyStart = -1;
  let angleDepth = 0;

  for (let index = parameterEnd + 1; index < source.length; index += 1) {
    const character = source[index];

    if (character === "<") {
      angleDepth += 1;
      continue;
    }

    if (character === ">") {
      if (angleDepth > 0) angleDepth -= 1;
      continue;
    }

    if (character === "{" && angleDepth === 0) {
      bodyStart = index;
      break;
    }
  }

  assert.notEqual(bodyStart, -1, `Could not find method body: ${methodSignature}`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart, index + 1);
    }
  }

  throw new Error(`Could not parse method body: ${methodSignature}`);
}

describe("repository transaction integrity", () => {
  it("wraps account deletion and transfer writes in SQLite transactions", () => {
    const accountSource = readSource("../src/database/repositories/account-repository.ts");
    const transactionSource = readSource("../src/database/repositories/transaction-repository.ts");

    assert.match(getMethodBody(accountSource, "async delete(id: string)"), /withTransactionAsync/);
    assert.match(getMethodBody(transactionSource, "async createTransfer(input: CreateTransferInput)"), /withTransactionAsync/);
    assert.match(getMethodBody(transactionSource, "async updateTransfer(id: string"), /withTransactionAsync/);
  });

  it("wraps loan creation, payment, deletion, and loan updates in SQLite transactions", () => {
    const source = readSource("../src/database/repositories/loan-repository.ts");

    assert.match(getMethodBody(source, "async create(input: CreateLoanInput)"), /withTransactionAsync/);
    assert.match(getMethodBody(source, "async update(input: CreateLoanInput)"), /withTransactionAsync/);
    assert.match(getMethodBody(source, "async recordPayment(input: CreateLoanPaymentInput)"), /withTransactionAsync/);
    assert.match(getMethodBody(source, "async deletePayment(paymentId: string)"), /withTransactionAsync/);
    assert.match(getMethodBody(source, "async delete(id: string)"), /withTransactionAsync/);
  });

  it("wraps subscription payment and deletion cascades in SQLite transactions", () => {
    const source = readSource("../src/database/repositories/subscription-repository.ts");

    assert.match(getMethodBody(source, "async recordPayment(input: RecordSubscriptionPaymentInput)"), /withTransactionAsync/);
    assert.match(getMethodBody(source, "async deletePayment(id: string)"), /withTransactionAsync/);
    assert.match(getMethodBody(source, "async delete(id: string)"), /withTransactionAsync/);
  });

  it("wraps recurring generation in one SQLite transaction", () => {
    const source = readSource("../src/database/repositories/recurring-repository.ts");

    assert.match(getMethodBody(source, "async generateDue(throughDate:string)"), /withTransactionAsync/);
  });
  it("relies on database triggers for payment activity logs without inserting duplicates", () => {
    const loanSource = readSource("../src/database/repositories/loan-repository.ts");
    const subscriptionSource = readSource("../src/database/repositories/subscription-repository.ts");
    const migrationSource = readSource("../src/database/migrations/index.ts");

    assert.doesNotMatch(
      getMethodBody(loanSource, "async recordPayment(input: CreateLoanPaymentInput)"),
      /INSERT INTO activity_logs/,
    );
    assert.doesNotMatch(
      getMethodBody(loanSource, "async deletePayment(paymentId: string)"),
      /INSERT INTO activity_logs/,
    );
    assert.doesNotMatch(
      getMethodBody(subscriptionSource, "async recordPayment(input: RecordSubscriptionPaymentInput)"),
      /INSERT INTO activity_logs/,
    );

    assert.match(migrationSource, /activity_loan_payments_created/);
    assert.match(migrationSource, /activity_loan_payments_deleted/);
    assert.match(migrationSource, /activity_subscription_payments_created/);
    assert.match(migrationSource, /activity_subscription_payments_deleted/);
  });

  it("keeps loan and subscription payment validation inside their write transactions", () => {
    const loanSource = readSource("../src/database/repositories/loan-repository.ts");
    const subscriptionSource = readSource("../src/database/repositories/subscription-repository.ts");
    const loanPayment = getMethodBody(loanSource, "async recordPayment(input: CreateLoanPaymentInput)");
    const subscriptionPayment = getMethodBody(subscriptionSource, "async recordPayment(input: RecordSubscriptionPaymentInput)");

    assert.ok(loanPayment.indexOf("withTransactionAsync") < loanPayment.indexOf("getLoanRow(input.loanId)"));
    assert.ok(loanPayment.indexOf("withTransactionAsync") < loanPayment.indexOf("calculateRemaining(input.loanId)"));
    assert.ok(subscriptionPayment.indexOf("withTransactionAsync") < subscriptionPayment.indexOf("getSubscriptionRow(db, input.subscriptionId)"));
    assert.match(subscriptionPayment, /AND is_active = 1 AND next_billing_date = \?/);
  });

  it("protects recurring occurrences with a unique key and conflict-safe inserts", () => {
    const recurringSource = readSource("../src/database/repositories/recurring-repository.ts");
    const migrationSource = readSource("../src/database/migrations/index.ts");
    const generation = getMethodBody(recurringSource, "async generateDue(throughDate:string)");

    assert.match(migrationSource, /CREATE UNIQUE INDEX idx_transactions_recurring_occurrence/);
    assert.match(migrationSource, /ON transactions\(recurring_rule_id, recurring_occurrence_date\)/);
    assert.match(generation, /INSERT OR IGNORE INTO transactions/);
    assert.match(generation, /UPDATE recurring_rules SET next_occurrence_date/);
  });


  it("creates backups from one consistent snapshot and safely quotes restored column names", () => {
    const source = readSource("../src/services/backup/backup-repository.ts");
    const createBackup = getMethodBody(source, "async createBackup()");
    const restore = getMethodBody(source, "async restoreJson(text: string)");

    assert.match(createBackup, /withTransactionAsync/);
    assert.ok(createBackup.indexOf("withTransactionAsync") < createBackup.indexOf("for (const table of BACKUP_TABLES)"));
    assert.match(restore, /quoteIdentifier/);
    assert.match(source, /identifier\.replace\(\/"\/g, '""'\)/);
  });

  it("reads subscription payment and billing state inside the deletion transaction", () => {
    const source = readSource("../src/database/repositories/subscription-repository.ts");
    const deletion = getMethodBody(source, "async deletePayment(id: string)");

    assert.ok(deletion.indexOf("withTransactionAsync") < deletion.indexOf("SELECT sp.subscription_id"));
    assert.ok(deletion.indexOf("withTransactionAsync") < deletion.indexOf("getSubscriptionRow(db, payment.subscription_id)"));
    assert.ok(deletion.indexOf("getSubscriptionRow(db, payment.subscription_id)") < deletion.indexOf("DELETE FROM subscription_payments"));
    assert.match(deletion, /WHERE id = \? AND next_billing_date = \?/);
    assert.match(deletion, /deleted\.changes !== 1/);
  });

  it("cleans account-linked records transactionally while retaining activity history", () => {
    const source = readSource("../src/database/repositories/account-repository.ts");
    const deletion = getMethodBody(source, "async delete(id: string)");

    assert.match(deletion, /withTransactionAsync/);
    assert.ok(deletion.indexOf("DELETE FROM transactions") < deletion.indexOf("DELETE FROM accounts"));
    for (const table of ["budgets", "goal_contributions", "loan_payments", "subscription_payments", "recurring_rules", "savings_goals", "loans", "subscriptions"]) {
      assert.match(deletion, new RegExp("DELETE FROM " + table));
    }
    assert.doesNotMatch(deletion, /DELETE FROM activity_logs/);
  });

  it("preserves linked loan and subscription transaction history when records are deleted", () => {
    const loanSource = readSource("../src/database/repositories/loan-repository.ts");
    const subscriptionSource = readSource("../src/database/repositories/subscription-repository.ts");
    const loanDelete = getMethodBody(loanSource, "async delete(id: string)");
    const subscriptionDelete = getMethodBody(subscriptionSource, "async delete(id: string)");

    assert.match(loanDelete, /UPDATE transactions SET deleted_at/);
    assert.ok(loanDelete.indexOf("UPDATE transactions SET deleted_at") < loanDelete.indexOf("DELETE FROM loan_payments"));
    assert.match(subscriptionDelete, /UPDATE transactions SET deleted_at/);
    assert.ok(subscriptionDelete.indexOf("UPDATE transactions SET deleted_at") < subscriptionDelete.indexOf("DELETE FROM subscription_payments"));
  });

});
