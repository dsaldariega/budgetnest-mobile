import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrateDatabase } from "../src/database/migrations";
import { createAccountRepository } from "../src/database/repositories/account-repository";
import { createLoanRepository } from "../src/database/repositories/loan-repository";
import { createRecurringRepository } from "../src/database/repositories/recurring-repository";
import { createSubscriptionRepository } from "../src/database/repositories/subscription-repository";
import { createTransactionRepository } from "../src/database/repositories/transaction-repository";
import { createBackupRepository } from "../src/services/backup/backup-repository";
import { calculateBackupChecksum } from "../src/services/backup/backup-integrity";

class TestSQLiteDatabase {
  constructor(private readonly native: DatabaseSync) { }

  private bindings(parameters: unknown[]): never[] {
    const values = parameters.length === 1 && Array.isArray(parameters[0])
      ? parameters[0]
      : parameters;
    return values as never[];
  }

  async execAsync(sql: string): Promise<void> {
    this.native.exec(sql);
  }

  async getFirstAsync<T>(sql: string, ...parameters: unknown[]): Promise<T | null> {
    const row = this.native.prepare(sql).get(...this.bindings(parameters)) as T | undefined;
    return row ?? null;
  }

  async getAllAsync<T>(sql: string, ...parameters: unknown[]): Promise<T[]> {
    return this.native.prepare(sql).all(...this.bindings(parameters)) as T[];
  }

  async runAsync(
    sql: string,
    ...parameters: unknown[]
  ): Promise<{ changes: number; lastInsertRowId: number }> {
    const result = this.native.prepare(sql).run(...this.bindings(parameters));
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.native.exec("BEGIN IMMEDIATE");
    try {
      await task();
      this.native.exec("COMMIT");
    } catch (error) {
      this.native.exec("ROLLBACK");
      throw error;
    }
  }
}

async function withDatabase(
  callback: (db: TestSQLiteDatabase) => Promise<void>,
): Promise<void> {
  const native = new DatabaseSync(":memory:");
  const db = new TestSQLiteDatabase(native);

  try {
    await migrateDatabase(db as never);
    const now = "2026-01-01T00:00:00.000Z";
    await db.runAsync(
      "INSERT INTO accounts (id, name, type, source_type, currency_code, opening_balance_minor, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, 'PHP', ?, 0, ?, ?)",
      "cash",
      "Cash wallet",
      "cash",
      "cash",
      10_000,
      now,
      now,
    );
    await db.runAsync(
      "INSERT INTO accounts (id, name, type, source_type, currency_code, opening_balance_minor, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, 'PHP', ?, 0, ?, ?)",
      "bank",
      "Bank account",
      "bank",
      "bank",
      5_000,
      now,
      now,
    );
    await callback(db);
  } finally {
    native.close();
  }
}

describe("financial workflow integration", () => {
  it("creates loans, allocates payments, settles the balance, and rolls back failed writes", async () => {
    await withDatabase(async db => {
      const loans = createLoanRepository(db as never);
      await loans.create({
        id: "loan-1",
        name: "Test loan",
        principalMinor: 100_000,
        monthlyInterestRateBps: 1_000,
        interestType: "flat_rate",
        termMonths: 2,
        startDate: "2026-01-01",
        dueDate: "2026-03-01",
        accountId: "cash",
      });

      const loanTransactionCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM transactions WHERE id = ?",
        "loan-loan-1",
      );
      assert.equal(loanTransactionCount?.count, 0);

      await db.runAsync(
        "INSERT INTO loan_payments (id, loan_id, amount_minor, interest_paid_minor, principal_paid_minor, payment_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        "payment-rollback",
        "loan-1",
        100,
        0,
        100,
        "2026-02-01",
        null,
        "2026-02-01T00:00:00.000Z",
      );

      await assert.rejects(
        loans.recordPayment({
          id: "payment-rollback",
          loanId: "loan-1",
          amountMinor: 60_000,
          paymentDate: "2026-02-01",
        }),
        /UNIQUE constraint failed/,
      );
      const rolledBackActivity = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM activity_logs WHERE entity_type = 'loan' AND entity_id = ? AND action = 'loan.payment_recorded'",
        "loan-1",
      );
      assert.equal(rolledBackActivity?.count, 1);
      const rolledBackPayment = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM loan_payments WHERE id = ?",
        "payment-rollback",
      );
      assert.equal(rolledBackPayment?.count, 1);
      await db.runAsync("DELETE FROM loan_payments WHERE id = ?", "payment-rollback");

      await loans.recordPayment({
        id: "payment-1",
        loanId: "loan-1",
        amountMinor: 60_000,
        paymentDate: "2026-02-01",
      });
      await loans.recordPayment({
        id: "payment-2",
        loanId: "loan-1",
        amountMinor: 60_000,
        paymentDate: "2026-03-01",
      });

      const [loan] = await loans.list();
      const payments = await loans.listPayments("loan-1");
      assert.equal(loan.status, "paid");
      assert.equal(loan.remainingMinor, 0);
      assert.equal(payments.length, 2);
      const loanPaymentActivity = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM activity_logs WHERE entity_type = 'loan' AND entity_id = ? AND action = 'loan.payment_recorded'",
        "loan-1",
      );
      assert.equal(loanPaymentActivity?.count, 2);
      assert.equal(
        payments.reduce((total, payment) => total + payment.interestPaidMinor, 0),
        20_000,
      );
      assert.equal(
        payments.reduce((total, payment) => total + payment.principalPaidMinor, 0),
        100_000,
      );

      const cash = (await createAccountRepository(db as never).listAll())
        .find(account => account.id === "cash");
      assert.equal(cash?.balanceMinor, 10_000);
    });
  });

  it("advances subscription billing and reverses it when the latest payment is deleted", async () => {
    await withDatabase(async db => {
      const subscriptions = createSubscriptionRepository(db as never);
      await subscriptions.create({
        id: "subscription-1",
        name: "Monthly service",
        amountMinor: 2_500,
        billingCycle: "monthly",
        nextBillingDate: "2026-01-31",
        accountId: "cash",
        categoryId: "cat-expense-bills",
      });

      await subscriptions.recordPayment({
        id: "subscription-payment-1",
        subscriptionId: "subscription-1",
        amountMinor: 2_500,
      });

      let subscription = (await subscriptions.list())[0];
      assert.equal(subscription.nextBillingDate, "2026-02-28");
      await subscriptions.deletePayment("subscription-payment-1");
      subscription = (await subscriptions.list())[0];
      assert.equal(subscription.nextBillingDate, "2026-01-31");
      assert.equal((await subscriptions.listPayments("subscription-1")).length, 0);
      const paymentActivity = await db.getFirstAsync<{ recorded: number; deleted: number }>(
        "SELECT SUM(action = 'subscription.payment_recorded') AS recorded, SUM(action = 'subscription.payment_deleted') AS deleted FROM activity_logs WHERE entity_type = 'subscription' AND entity_id = ?",
        "subscription-1",
      );
      assert.equal(paymentActivity?.recorded, 1);
      assert.equal(paymentActivity?.deleted, 1);

      const paymentTransactionCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM transactions WHERE id = ?",
        "subscription-payment-subscription-payment-1",
      );
      assert.equal(paymentTransactionCount?.count, 0);

      const cash = (await createAccountRepository(db as never).listAll())
        .find(account => account.id === "cash");
      assert.equal(cash?.balanceMinor, 10_000);
    });
  });

  it("generates recurring entries once and skips duplicate occurrences", async () => {
    await withDatabase(async db => {
      const recurring = createRecurringRepository(db as never);
      await recurring.save({
        id: "recurring-1",
        name: "Weekly allowance",
        type: "expense",
        amountMinor: 1_000,
        accountId: "cash",
        categoryId: "cat-expense-food",
        frequency: "weekly",
        intervalCount: 1,
        startDate: "2026-01-01",
        endDate: "2026-01-15",
      });

      assert.deepEqual(
        await recurring.generateDue("2026-01-15"),
        { generatedCount: 3, skippedCount: 0 },
      );
      const initialCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM transactions WHERE recurring_rule_id = ?",
        "recurring-1",
      );
      assert.equal(initialCount?.count, 3);
      const generatedActivity = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM activity_logs WHERE entity_type = 'transaction' AND action = 'transaction.created' AND entity_id IN (SELECT id FROM transactions WHERE recurring_rule_id = ?)",
        "recurring-1",
      );
      assert.equal(generatedActivity?.count, 3);

      await db.runAsync(
        "UPDATE recurring_rules SET next_occurrence_date = ?, is_active = 1 WHERE id = ?",
        "2026-01-01",
        "recurring-1",
      );
      assert.deepEqual(
        await recurring.generateDue("2026-01-15"),
        { generatedCount: 0, skippedCount: 3 },
      );
      const finalCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM transactions WHERE recurring_rule_id = ?",
        "recurring-1",
      );
      assert.equal(finalCount?.count, 3);
    });
  });

  it("keeps transfer pairs atomic and preserves the combined account balance", async () => {
    await withDatabase(async db => {
      const transactions = createTransactionRepository(db as never);
      const accounts = createAccountRepository(db as never);

      await transactions.createTransfer({
        groupId: "transfer-1",
        sourceAccountId: "cash",
        destinationAccountId: "bank",
        amountMinor: 2_500,
        occurredAt: "2026-01-10",
      });

      let balances = await accounts.listAll();
      assert.equal(balances.find(account => account.id === "cash")?.balanceMinor, 7_500);
      assert.equal(balances.find(account => account.id === "bank")?.balanceMinor, 7_500);
      const createdTransferActivity = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM activity_logs WHERE action = 'transaction.created' AND entity_id IN ('transfer-1-out', 'transfer-1-in')",
      );
      assert.equal(createdTransferActivity?.count, 1);

      await transactions.updateTransfer("transfer-1-out", {
        sourceAccountId: "cash",
        destinationAccountId: "bank",
        amountMinor: 3_000,
        occurredAt: "2026-01-10",
      });
      balances = await accounts.listAll();
      assert.equal(balances.find(account => account.id === "cash")?.balanceMinor, 7_000);
      assert.equal(balances.find(account => account.id === "bank")?.balanceMinor, 8_000);
      const updatedTransferActivity = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM activity_logs WHERE action = 'transaction.updated' AND entity_id IN ('transfer-1-out', 'transfer-1-in')",
      );
      assert.equal(updatedTransferActivity?.count, 1);
      assert.equal(
        balances.reduce((total, account) => total + account.balanceMinor, 0),
        15_000,
      );

      await transactions.createTransfer({
        groupId: "transfer-2",
        sourceAccountId: "cash",
        destinationAccountId: "bank",
        amountMinor: 500,
        occurredAt: "2026-01-12",
      });
      await transactions.delete("transfer-2-out");
      const deletedTransferActivity = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM activity_logs WHERE action = 'transaction.deleted' AND entity_id IN ('transfer-2-out', 'transfer-2-in')",
      );
      assert.equal(deletedTransferActivity?.count, 1);

      await db.runAsync("DELETE FROM transactions WHERE id = ?", "transfer-1-in");
      await assert.rejects(
        transactions.updateTransfer("transfer-1-out", {
          sourceAccountId: "cash",
          destinationAccountId: "bank",
          amountMinor: 4_000,
          occurredAt: "2026-01-11",
        }),
        /exactly one outgoing and one incoming/,
      );
      const outgoing = await db.getFirstAsync<{ amount_minor: number }>(
        "SELECT amount_minor FROM transactions WHERE id = ?",
        "transfer-1-out",
      );
      assert.equal(outgoing?.amount_minor, 3_000);
    });
  });

  it("rolls back a failed restore and preserves the existing database", async () => {
    await withDatabase(async db => {
      const backups = createBackupRepository(db as never);
      await db.runAsync("UPDATE accounts SET name = ? WHERE id = ?", "Original local account", "cash");
      const backup = await backups.createBackup();

      backup.data.transactions.push({
        id: "invalid-restore-transaction",
        account_id: "missing-account",
        type: "expense",
        amount_minor: 100,
        description: "Invalid foreign key",
        occurred_at: "2026-01-02",
        created_at: "2026-01-02T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      });
      backup.metadata.recordCounts.transactions += 1;
      backup.metadata.checksum = calculateBackupChecksum(backup.data);

      await assert.rejects(backups.restoreJson(JSON.stringify(backup)));

      const account = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM accounts WHERE id = ?",
        "cash",
      );
      assert.equal(account?.name, "Original local account");

      const restoreFlag = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM app_settings WHERE key = ?",
        "backup_restore_in_progress",
      );
      assert.equal(restoreFlag?.count, 0);

      const transactionCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM transactions",
      );
      assert.equal(transactionCount?.count, 0);
    });
  });

  it("restores a real database snapshot and rejects a modified backup without changing data", async () => {
    await withDatabase(async db => {
      const backups = createBackupRepository(db as never);
      await db.runAsync("UPDATE accounts SET name = ? WHERE id = ?", "Cash wallet before export", "cash");
      const activityCountBeforeExport = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM activity_logs",
      );
      const backup = await backups.exportJson();

      await db.runAsync("UPDATE accounts SET name = ? WHERE id = ?", "Changed after export", "cash");
      await backups.restoreJson(backup);
      let account = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM accounts WHERE id = ?",
        "cash",
      );
      assert.equal(account?.name, "Cash wallet before export");
      const restoredLogCount = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM activity_logs",
      );
      assert.equal(restoredLogCount?.count, activityCountBeforeExport?.count);

      await db.runAsync("UPDATE accounts SET name = ? WHERE id = ?", "Keep this value", "cash");
      const activityCountBeforeRejectedRestore = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM activity_logs",
      );
      const tampered = JSON.parse(backup) as {
        data: { accounts: Array<{ name: string }> };
      };
      tampered.data.accounts[0].name = "Tampered backup";
      await assert.rejects(
        backups.restoreJson(JSON.stringify(tampered)),
        /integrity check failed/i,
      );

      account = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM accounts WHERE id = ?",
        "cash",
      );
      assert.equal(account?.name, "Keep this value");
      const logCountAfterRejectedRestore = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM activity_logs",
      );
      assert.equal(logCountAfterRejectedRestore?.count, activityCountBeforeRejectedRestore?.count);
    });
  });
});


describe("database performance indexes", () => {
  it("uses the active transaction ordering index for recent activity queries", async () => {
    await withDatabase(async db => {
      const indexes = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index'",
      );
      const names = new Set(indexes.map(index => index.name));

      assert.ok(names.has("idx_transactions_active_occurred_at"));
      assert.ok(names.has("idx_activity_logs_created_at_id"));
      assert.ok(names.has("idx_goal_contributions_date"));

      const plan = await db.getAllAsync<{ detail: string }>(
        "EXPLAIN QUERY PLAN SELECT id FROM transactions WHERE deleted_at IS NULL ORDER BY occurred_at DESC, created_at DESC LIMIT 200",
      );
      assert.ok(
        plan.some(row => row.detail.includes("idx_transactions_active_occurred_at")),
        "recent transaction query should use the active transaction ordering index",
      );
    });
  });
});
