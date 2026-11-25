import type { SQLiteDatabase } from "expo-sqlite";

export type DatabaseMigration = {
  version: number;
  description: string;
  sql: string;
};

/**
 * Applied migrations are immutable. Add a new migration with the next version
 * instead of editing a migration that may already exist on a user's device.
 */
export const migrations: DatabaseMigration[] = [
  {
    version: 1,
    description: "Create the initial BudgetNest local data model",
    sql: `
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'e_wallet', 'credit_card', 'other')),
        currency_code TEXT NOT NULL DEFAULT 'PHP' CHECK (length(currency_code) = 3),
        opening_balance_minor INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        icon TEXT,
        color TEXT,
        is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (name, type)
      );

      CREATE TABLE transactions (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        transfer_group_id TEXT,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        description TEXT NOT NULL DEFAULT '',
        notes TEXT,
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE budgets (
        id TEXT PRIMARY KEY NOT NULL,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly', 'custom')),
        start_date TEXT NOT NULL,
        end_date TEXT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        rollover_enabled INTEGER NOT NULL DEFAULT 0 CHECK (rollover_enabled IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE savings_goals (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        target_amount_minor INTEGER NOT NULL CHECK (target_amount_minor > 0),
        target_date TEXT,
        icon TEXT,
        color TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE goal_contributions (
        id TEXT PRIMARY KEY NOT NULL,
        goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE RESTRICT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        contributed_at TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE subscriptions (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly', 'yearly', 'custom')),
        next_billing_date TEXT,
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_transactions_account_date
        ON transactions(account_id, occurred_at DESC);
      CREATE INDEX idx_transactions_category_date
        ON transactions(category_id, occurred_at DESC);
      CREATE INDEX idx_transactions_transfer_group
        ON transactions(transfer_group_id);
      CREATE INDEX idx_budgets_category_period
        ON budgets(category_id, start_date, end_date);
      CREATE INDEX idx_goal_contributions_goal_date
        ON goal_contributions(goal_id, contributed_at DESC);
      CREATE INDEX idx_subscriptions_active_date
        ON subscriptions(is_active, next_billing_date);
    `,
  },
];

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");

  const result = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let currentVersion = result?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await db.execAsync("BEGIN IMMEDIATE");
    try {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
      await db.execAsync("COMMIT");
      currentVersion = migration.version;
    } catch (error) {
      await db.execAsync("ROLLBACK");
      throw error;
    }
  }
}
