import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { migrations, migrateDatabase } from "../src/database/migrations";
import { DATABASE_SCHEMA_VERSION } from "../src/services/backup/backup-format";

describe("database migration integrity", () => {
  it("keeps migration versions unique and strictly increasing", () => {
    const versions = migrations.map(migration => migration.version);

    assert.ok(versions.length > 0);
    assert.equal(new Set(versions).size, versions.length);

    for (let index = 1; index < versions.length; index += 1) {
      assert.equal(versions[index], versions[index - 1] + 1);
    }
  });

  it("keeps the backup schema version aligned with the latest database migration", () => {
    assert.equal(DATABASE_SCHEMA_VERSION, migrations[migrations.length - 1].version);
  });

  it("keeps migration descriptions and SQL non-empty", () => {
    for (const migration of migrations) {
      assert.ok(migration.description.trim().length > 0);
      assert.ok(migration.sql.trim().length > 0);
    }
  });

  it("keeps released migrations free of migration-runner state changes", () => {
    for (const migration of migrations) {
      assert.doesNotMatch(migration.sql, /PRAGMA\s+user_version\s*=/i);
      assert.doesNotMatch(migration.sql, /BEGIN\s+(?:IMMEDIATE|TRANSACTION)/i);
      assert.doesNotMatch(migration.sql, /COMMIT|ROLLBACK/i);
    }
  });

  it("defines the core financial tables in the initial migration", () => {
    const initialSql = migrations.find(migration => migration.version === 1)?.sql ?? "";

    for (const table of [
      "accounts",
      "categories",
      "transactions",
      "budgets",
      "savings_goals",
      "goal_contributions",
      "subscriptions",
      "app_settings",
    ]) {
      assert.match(initialSql, new RegExp(`CREATE TABLE ${table}\\b`, "i"));
    }
  });

  it("introduces loan, subscription payment, and activity history together", () => {
    const sql = migrations.find(migration => migration.version === 2)?.sql ?? "";

    for (const table of ["loans", "loan_payments", "subscription_payments", "activity_logs"]) {
      assert.match(sql, new RegExp(`CREATE TABLE ${table}\\b`, "i"));
    }

    assert.match(sql, /CHECK\s*\(interest_paid_minor \+ principal_paid_minor = amount_minor\)/i);
    assert.match(sql, /CREATE INDEX idx_loan_payments_loan_date/i);
    assert.match(sql, /CREATE INDEX idx_subscription_payments_subscription_date/i);
    assert.match(sql, /CREATE INDEX idx_activity_logs_created_at/i);
  });

  it("protects recurring transaction generation from duplicates", () => {
    const sql = migrations.find(migration => migration.version === 5)?.sql ?? "";

    assert.match(sql, /recurring_rule_id/i);
    assert.match(sql, /recurring_occurrence_date/i);
    assert.match(sql, /CREATE UNIQUE INDEX idx_transactions_recurring_occurrence/i);
    assert.match(sql, /WHERE recurring_rule_id IS NOT NULL AND recurring_occurrence_date IS NOT NULL/i);
  });

  it("adds activity logging without weakening backup-restore protection", () => {
    const sql = migrations.find(migration => migration.version === 6)?.sql ?? "";

    assert.match(sql, /CREATE TRIGGER IF NOT EXISTS/i);
    assert.match(sql, /activity_accounts_created/i);
    assert.match(sql, /activity_transactions_created/i);
    assert.match(sql, /activity_loans_created/i);
    assert.match(sql, /activity_subscriptions_created/i);
    assert.match(sql, /activity_recurring_created/i);
    assert.match(sql, /backup_restore_in_progress/i);
  });

  it("keeps paired transfer activity logs to one entry per operation", () => {
    const sql = migrations.find(migration => migration.version === 9)?.sql ?? "";

    assert.match(sql, /DROP TRIGGER IF EXISTS activity_transactions_updated/i);
    assert.match(sql, /NEW\.type <> 'transfer' OR NEW\.transfer_direction = 'out'/i);
    assert.match(sql, /OLD\.type <> 'transfer' OR OLD\.transfer_direction = 'out'/i);
  });

  it("adds indexes for active transaction, activity log, and contribution timelines", () => {
    const sql = migrations.find(migration => migration.version === 10)?.sql ?? "";

    assert.ok(sql.includes("idx_transactions_active_occurred_at"));
    assert.ok(sql.includes("ON transactions(occurred_at DESC, created_at DESC)"));
    assert.ok(sql.includes("WHERE deleted_at IS NULL"));
    assert.ok(sql.includes("idx_activity_logs_created_at_id"));
    assert.ok(sql.includes("idx_goal_contributions_date"));
  });

  it("keeps the migration runner transactional and enables SQLite integrity settings", () => {
    const runnerSource = migrateDatabase.toString();

    assert.match(runnerSource, /PRAGMA foreign_keys = ON/i);
    assert.match(runnerSource, /PRAGMA journal_mode = WAL/i);
    assert.match(runnerSource, /BEGIN IMMEDIATE/i);
    assert.match(runnerSource, /PRAGMA user_version/i);
    assert.match(runnerSource, /COMMIT/i);
    assert.match(runnerSource, /ROLLBACK/i);
  });
});
