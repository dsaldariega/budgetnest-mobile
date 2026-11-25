import type { SQLiteDatabase } from "expo-sqlite";

export type DatabaseMigration = { version: number; description: string; sql: string };

/** Applied migrations are immutable. Add a new migration instead of editing a released one. */
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
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        icon TEXT, color TEXT,
        is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE (name, type)
      );
      CREATE TABLE transactions (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        transfer_group_id TEXT,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        description TEXT NOT NULL DEFAULT '', notes TEXT, occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
      );
      CREATE TABLE budgets (
        id TEXT PRIMARY KEY NOT NULL,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly', 'custom')),
        start_date TEXT NOT NULL, end_date TEXT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        rollover_enabled INTEGER NOT NULL DEFAULT 0 CHECK (rollover_enabled IN (0, 1)),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE savings_goals (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        target_amount_minor INTEGER NOT NULL CHECK (target_amount_minor > 0),
        target_date TEXT, icon TEXT, color TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE goal_contributions (
        id TEXT PRIMARY KEY NOT NULL,
        goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE RESTRICT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        contributed_at TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE subscriptions (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
        next_billing_date TEXT,
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX idx_transactions_account_date ON transactions(account_id, occurred_at DESC);
      CREATE INDEX idx_transactions_category_date ON transactions(category_id, occurred_at DESC);
      CREATE INDEX idx_transactions_transfer_group ON transactions(transfer_group_id);
      CREATE INDEX idx_budgets_category_period ON budgets(category_id, start_date, end_date);
      CREATE INDEX idx_goal_contributions_goal_date ON goal_contributions(goal_id, contributed_at DESC);
      CREATE INDEX idx_subscriptions_active_date ON subscriptions(is_active, next_billing_date);
    `,
  },
  {
    version: 2,
    description: "Expand financial compatibility and add loan and recurring payment history",
    sql: `
      ALTER TABLE accounts ADD COLUMN source_type TEXT;
      ALTER TABLE categories ADD COLUMN source_name TEXT;
      ALTER TABLE savings_goals ADD COLUMN legacy_current_amount_minor INTEGER;
      CREATE TABLE transactions_next (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        transfer_group_id TEXT,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
        transfer_direction TEXT CHECK (transfer_direction IN ('in', 'out')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        description TEXT NOT NULL DEFAULT '', notes TEXT, occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
        CHECK (
          (type = 'transfer' AND transfer_group_id IS NOT NULL AND transfer_direction IS NOT NULL AND category_id IS NULL)
          OR (type IN ('income', 'expense') AND transfer_group_id IS NULL AND transfer_direction IS NULL)
        )
      );
      INSERT INTO transactions_next (
        id, account_id, category_id, transfer_group_id, type, transfer_direction,
        amount_minor, description, notes, occurred_at, created_at, updated_at, deleted_at
      )
      SELECT id, account_id, category_id, NULL, type, NULL, amount_minor, description,
        notes, occurred_at, created_at, updated_at, deleted_at FROM transactions;
      DROP INDEX IF EXISTS idx_transactions_account_date;
      DROP INDEX IF EXISTS idx_transactions_category_date;
      DROP INDEX IF EXISTS idx_transactions_transfer_group;
      DROP TABLE transactions;
      ALTER TABLE transactions_next RENAME TO transactions;
      CREATE INDEX idx_transactions_account_date ON transactions(account_id, occurred_at DESC);
      CREATE INDEX idx_transactions_category_date ON transactions(category_id, occurred_at DESC);
      CREATE INDEX idx_transactions_transfer_group ON transactions(transfer_group_id);
      CREATE TABLE subscriptions_next (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
        next_billing_date TEXT,
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO subscriptions_next SELECT * FROM subscriptions;
      DROP INDEX IF EXISTS idx_subscriptions_active_date;
      DROP TABLE subscriptions;
      ALTER TABLE subscriptions_next RENAME TO subscriptions;
      CREATE INDEX idx_subscriptions_active_date ON subscriptions(is_active, next_billing_date);
      CREATE TABLE loans (
        id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        principal_minor INTEGER NOT NULL CHECK (principal_minor > 0),
        monthly_interest_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (monthly_interest_rate_bps >= 0),
        interest_type TEXT NOT NULL CHECK (interest_type IN ('flat_rate', 'reducing_balance')),
        term_months INTEGER NOT NULL CHECK (term_months > 0),
        start_date TEXT NOT NULL, due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'paused')),
        account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
        notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE loan_payments (
        id TEXT PRIMARY KEY NOT NULL, loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        interest_paid_minor INTEGER NOT NULL DEFAULT 0 CHECK (interest_paid_minor >= 0),
        principal_paid_minor INTEGER NOT NULL DEFAULT 0 CHECK (principal_paid_minor >= 0),
        payment_date TEXT NOT NULL, notes TEXT, created_at TEXT NOT NULL,
        CHECK (interest_paid_minor + principal_paid_minor = amount_minor)
      );
      CREATE TABLE subscription_payments (
        id TEXT PRIMARY KEY NOT NULL, subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        billing_date TEXT NOT NULL, paid_at TEXT NOT NULL, notes TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE activity_logs (
        id TEXT PRIMARY KEY NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
        action TEXT NOT NULL, summary TEXT NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL
      );
      CREATE INDEX idx_loans_status_due_date ON loans(status, due_date);
      CREATE INDEX idx_loan_payments_loan_date ON loan_payments(loan_id, payment_date, created_at);
      CREATE INDEX idx_subscription_payments_subscription_date ON subscription_payments(subscription_id, billing_date DESC);
      CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
    `,
  },
  {
    version: 3,
    description: "Seed default income and expense categories",
    sql: `
      INSERT OR IGNORE INTO categories (id, name, type, icon, is_system, created_at, updated_at) VALUES
        ('cat-income-salary', 'Salary', 'income', 'wallet', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('cat-income-business', 'Business', 'income', 'briefcase', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('cat-income-investment', 'Investment', 'income', 'trending-up', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('cat-income-other', 'Other income', 'income', 'plus-circle', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('cat-expense-food', 'Food & drinks', 'expense', 'utensils', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('cat-expense-transport', 'Transportation', 'expense', 'car', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('cat-expense-bills', 'Bills & utilities', 'expense', 'receipt', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('cat-expense-shopping', 'Shopping', 'expense', 'shopping-bag', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('cat-expense-health', 'Health', 'expense', 'heart-pulse', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('cat-expense-home', 'Home', 'expense', 'house', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('cat-expense-other', 'Other expense', 'expense', 'more-horizontal', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    `,
  },
];

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  const result = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let currentVersion = result?.user_version ?? 0;
  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
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