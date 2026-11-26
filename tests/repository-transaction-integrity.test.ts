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

});
