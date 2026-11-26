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

  {
    version: 4,
    description: "Link budgets and savings goals to accounts",
    sql: `
      ALTER TABLE budgets ADD COLUMN account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT;
      ALTER TABLE savings_goals ADD COLUMN account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT;
      CREATE INDEX idx_budgets_account_category ON budgets(account_id, category_id, start_date);
      CREATE INDEX idx_savings_goals_account ON savings_goals(account_id, is_archived);
    `,
  },
  {
    version: 5,
    description: "Add recurring income and expense schedules",
    sql: `
      CREATE TABLE recurring_rules (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
        interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count > 0),
        start_date TEXT NOT NULL,
        next_occurrence_date TEXT NOT NULL,
        end_date TEXT,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (end_date IS NULL OR end_date >= start_date)
      );
      ALTER TABLE transactions ADD COLUMN recurring_rule_id TEXT REFERENCES recurring_rules(id) ON DELETE SET NULL;
      ALTER TABLE transactions ADD COLUMN recurring_occurrence_date TEXT;
      CREATE UNIQUE INDEX idx_transactions_recurring_occurrence
        ON transactions(recurring_rule_id, recurring_occurrence_date)
        WHERE recurring_rule_id IS NOT NULL AND recurring_occurrence_date IS NOT NULL;
      CREATE INDEX idx_recurring_rules_active_date ON recurring_rules(is_active, next_occurrence_date);
    `,
  },

  {
    version: 6,
    description: "Capture key financial changes in the local activity log",
    sql: `
      CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_created_at
        ON activity_logs(entity_type, created_at DESC);

      CREATE TRIGGER IF NOT EXISTS activity_accounts_created
      AFTER INSERT ON accounts
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'account', NEW.id, 'account.created',
          'Created account: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_accounts_updated
      AFTER UPDATE ON accounts
      WHEN (OLD.name IS NOT NEW.name OR OLD.type IS NOT NEW.type OR OLD.source_type IS NOT NEW.source_type
        OR OLD.currency_code IS NOT NEW.currency_code OR OLD.opening_balance_minor IS NOT NEW.opening_balance_minor)
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'account', NEW.id, 'account.updated',
          'Updated account: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_accounts_archived
      AFTER UPDATE OF is_archived ON accounts
      WHEN OLD.is_archived = 0 AND NEW.is_archived = 1
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'account', NEW.id, 'account.archived',
          'Archived account: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_accounts_restored
      AFTER UPDATE OF is_archived ON accounts
      WHEN OLD.is_archived = 1 AND NEW.is_archived = 0
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'account', NEW.id, 'account.restored',
          'Restored account: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_accounts_deleted
      AFTER DELETE ON accounts
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'account', OLD.id, 'account.deleted',
          'Deleted account: ' || OLD.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_transactions_created
      AFTER INSERT ON transactions
      WHEN (NEW.type IN ('income', 'expense') OR (NEW.type = 'transfer' AND NEW.transfer_direction = 'out'))
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'transaction', NEW.id, 'transaction.created',
          'Added ' || NEW.type || ': ' || COALESCE(NULLIF(NEW.description, ''), 'Transaction'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_transactions_updated
      AFTER UPDATE ON transactions
      WHEN (OLD.account_id IS NOT NEW.account_id OR OLD.category_id IS NOT NEW.category_id
        OR OLD.type IS NOT NEW.type OR OLD.amount_minor IS NOT NEW.amount_minor
        OR OLD.description IS NOT NEW.description OR OLD.notes IS NOT NEW.notes
        OR OLD.occurred_at IS NOT NEW.occurred_at)
        AND OLD.deleted_at IS NEW.deleted_at
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'transaction', NEW.id, 'transaction.updated',
          'Updated transaction: ' || COALESCE(NULLIF(NEW.description, ''), 'Transaction'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_transactions_soft_deleted
      AFTER UPDATE OF deleted_at ON transactions
      WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'transaction', NEW.id, 'transaction.deleted',
          'Deleted transaction: ' || COALESCE(NULLIF(NEW.description, ''), 'Transaction'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_transactions_deleted
      AFTER DELETE ON transactions
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'transaction', OLD.id, 'transaction.deleted',
          'Deleted transaction: ' || COALESCE(NULLIF(OLD.description, ''), 'Transaction'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_budgets_created
      AFTER INSERT ON budgets
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'budget', NEW.id, 'budget.created',
          'Created budget for ' || COALESCE((SELECT name FROM categories WHERE id = NEW.category_id), 'a category'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_budgets_updated
      AFTER UPDATE ON budgets
      WHEN (OLD.category_id IS NOT NEW.category_id OR OLD.account_id IS NOT NEW.account_id
        OR OLD.period IS NOT NEW.period OR OLD.start_date IS NOT NEW.start_date
        OR OLD.end_date IS NOT NEW.end_date OR OLD.amount_minor IS NOT NEW.amount_minor
        OR OLD.rollover_enabled IS NOT NEW.rollover_enabled)
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'budget', NEW.id, 'budget.updated',
          'Updated budget for ' || COALESCE((SELECT name FROM categories WHERE id = NEW.category_id), 'a category'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_budgets_deleted
      AFTER DELETE ON budgets
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'budget', OLD.id, 'budget.deleted',
          'Deleted budget for ' || COALESCE((SELECT name FROM categories WHERE id = OLD.category_id), 'a category'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_goals_created
      AFTER INSERT ON savings_goals
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'goal', NEW.id, 'goal.created',
          'Created savings goal: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_goals_updated
      AFTER UPDATE ON savings_goals
      WHEN (OLD.name IS NOT NEW.name OR OLD.target_amount_minor IS NOT NEW.target_amount_minor
        OR OLD.target_date IS NOT NEW.target_date OR OLD.account_id IS NOT NEW.account_id
        OR OLD.icon IS NOT NEW.icon OR OLD.color IS NOT NEW.color)
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'goal', NEW.id, 'goal.updated',
          'Updated savings goal: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_goals_status_updated
      AFTER UPDATE OF is_archived ON savings_goals
      WHEN OLD.is_archived IS NOT NEW.is_archived
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'goal', NEW.id, 'goal.status_updated',
          'Changed savings goal status: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_goals_deleted
      AFTER DELETE ON savings_goals
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'goal', OLD.id, 'goal.deleted',
          'Deleted savings goal: ' || OLD.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_goal_contributions_created
      AFTER INSERT ON goal_contributions
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'goal', NEW.goal_id, 'goal.contribution_recorded',
          'Recorded a savings contribution', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_loans_created
      AFTER INSERT ON loans
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'loan', NEW.id, 'loan.created',
          'Created loan: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_loans_updated
      AFTER UPDATE ON loans
      WHEN (OLD.name IS NOT NEW.name OR OLD.principal_minor IS NOT NEW.principal_minor
        OR OLD.monthly_interest_rate_bps IS NOT NEW.monthly_interest_rate_bps
        OR OLD.interest_type IS NOT NEW.interest_type OR OLD.term_months IS NOT NEW.term_months
        OR OLD.start_date IS NOT NEW.start_date OR OLD.due_date IS NOT NEW.due_date
        OR OLD.account_id IS NOT NEW.account_id OR OLD.notes IS NOT NEW.notes)
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'loan', NEW.id, 'loan.updated',
          'Updated loan: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_loans_status_updated
      AFTER UPDATE OF status ON loans
      WHEN OLD.status IS NOT NEW.status
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'loan', NEW.id, 'loan.status_updated',
          'Changed loan status: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_loans_deleted
      AFTER DELETE ON loans
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'loan', OLD.id, 'loan.deleted',
          'Deleted loan: ' || OLD.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_loan_payments_created
      AFTER INSERT ON loan_payments
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'loan', NEW.loan_id, 'loan.payment_recorded',
          'Recorded a loan payment', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_loan_payments_deleted
      AFTER DELETE ON loan_payments
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'loan', OLD.loan_id, 'loan.payment_deleted',
          'Deleted a loan payment', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_subscriptions_created
      AFTER INSERT ON subscriptions
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'subscription', NEW.id, 'subscription.created',
          'Created subscription: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_subscriptions_updated
      AFTER UPDATE ON subscriptions
      WHEN (OLD.name IS NOT NEW.name OR OLD.amount_minor IS NOT NEW.amount_minor
        OR OLD.billing_cycle IS NOT NEW.billing_cycle OR OLD.next_billing_date IS NOT NEW.next_billing_date
        OR OLD.account_id IS NOT NEW.account_id OR OLD.category_id IS NOT NEW.category_id)
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'subscription', NEW.id, 'subscription.updated',
          'Updated subscription: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_subscriptions_status_updated
      AFTER UPDATE OF is_active ON subscriptions
      WHEN OLD.is_active IS NOT NEW.is_active
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'subscription', NEW.id, 'subscription.status_updated',
          'Changed subscription status: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_subscriptions_deleted
      AFTER DELETE ON subscriptions
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'subscription', OLD.id, 'subscription.deleted',
          'Deleted subscription: ' || OLD.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_subscription_payments_created
      AFTER INSERT ON subscription_payments
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'subscription', NEW.subscription_id, 'subscription.payment_recorded',
          'Recorded a subscription payment', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_subscription_payments_deleted
      AFTER DELETE ON subscription_payments
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'subscription', OLD.subscription_id, 'subscription.payment_deleted',
          'Deleted a subscription payment', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_recurring_created
      AFTER INSERT ON recurring_rules
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'recurring', NEW.id, 'recurring.created',
          'Created recurring schedule: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_recurring_updated
      AFTER UPDATE ON recurring_rules
      WHEN (OLD.name IS NOT NEW.name OR OLD.type IS NOT NEW.type OR OLD.amount_minor IS NOT NEW.amount_minor
        OR OLD.account_id IS NOT NEW.account_id OR OLD.category_id IS NOT NEW.category_id
        OR OLD.frequency IS NOT NEW.frequency OR OLD.interval_count IS NOT NEW.interval_count
        OR OLD.start_date IS NOT NEW.start_date OR OLD.next_occurrence_date IS NOT NEW.next_occurrence_date
        OR OLD.end_date IS NOT NEW.end_date)
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'recurring', NEW.id, 'recurring.updated',
          'Updated recurring schedule: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_recurring_status_updated
      AFTER UPDATE OF is_active ON recurring_rules
      WHEN OLD.is_active IS NOT NEW.is_active
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'recurring', NEW.id, 'recurring.status_updated',
          'Changed recurring schedule status: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_recurring_deleted
      AFTER DELETE ON recurring_rules
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'recurring', OLD.id, 'recurring.deleted',
          'Deleted recurring schedule: ' || OLD.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;
    `,
  },
  {
    version: 7,
    description: "Add dedicated loan and savings transaction categories",
    sql: `
      INSERT OR IGNORE INTO categories (id, name, type, icon, is_system, created_at, updated_at) VALUES
        ('cat-income-loan', 'Loans', 'income', 'bank', 1, '2026-11-26T00:00:00.000Z', '2026-11-26T00:00:00.000Z'),
        ('cat-expense-savings', 'Savings', 'expense', 'piggy-bank', 1, '2026-11-26T00:00:00.000Z', '2026-11-26T00:00:00.000Z');
    `,
  },
  {
    version: 8,
    description: "Add budget names, subscription categories, and repair activity triggers",
    sql: `
      ALTER TABLE budgets ADD COLUMN name TEXT NOT NULL DEFAULT '';

      INSERT OR IGNORE INTO categories (id, name, type, icon, is_system, source_name, created_at, updated_at) VALUES
        ('cat-expense-loan-payment', 'Loan payments', 'expense', 'cash-minus', 1, NULL, '2026-11-26T00:00:00.000Z', '2026-11-26T00:00:00.000Z'),
        ('cat-sub-cloud', 'Cloud Services', 'expense', 'cloud-outline', 1, 'subscription', '2026-11-26T00:00:00.000Z', '2026-11-26T00:00:00.000Z'),
        ('cat-sub-entertainment', 'Entertainment', 'expense', 'movie-open-outline', 1, 'subscription', '2026-11-26T00:00:00.000Z', '2026-11-26T00:00:00.000Z'),
        ('cat-sub-software', 'Software and Applications', 'expense', 'application-brackets-outline', 1, 'subscription', '2026-11-26T00:00:00.000Z', '2026-11-26T00:00:00.000Z'),
        ('cat-sub-gym', 'Gym and Fitness', 'expense', 'dumbbell', 1, 'subscription', '2026-11-26T00:00:00.000Z', '2026-11-26T00:00:00.000Z'),
        ('cat-sub-music', 'Music and Streaming', 'expense', 'music-note-outline', 1, 'subscription', '2026-11-26T00:00:00.000Z', '2026-11-26T00:00:00.000Z'),
        ('cat-sub-productivity', 'Productivity', 'expense', 'calendar-check-outline', 1, 'subscription', '2026-11-26T00:00:00.000Z', '2026-11-26T00:00:00.000Z'),
        ('cat-sub-education', 'Education', 'expense', 'school-outline', 1, 'subscription', '2026-11-26T00:00:00.000Z', '2026-11-26T00:00:00.000Z'),
        ('cat-sub-other', 'Other', 'expense', 'dots-horizontal-circle-outline', 1, 'subscription', '2026-11-26T00:00:00.000Z', '2026-11-26T00:00:00.000Z');


      CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_created_at
        ON activity_logs(entity_type, created_at DESC);

      CREATE TRIGGER IF NOT EXISTS activity_accounts_created
      AFTER INSERT ON accounts
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'account', NEW.id, 'account.created',
          'Created account: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_accounts_updated
      AFTER UPDATE ON accounts
      WHEN (OLD.name IS NOT NEW.name OR OLD.type IS NOT NEW.type OR OLD.source_type IS NOT NEW.source_type
        OR OLD.currency_code IS NOT NEW.currency_code OR OLD.opening_balance_minor IS NOT NEW.opening_balance_minor)
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'account', NEW.id, 'account.updated',
          'Updated account: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_accounts_archived
      AFTER UPDATE OF is_archived ON accounts
      WHEN OLD.is_archived = 0 AND NEW.is_archived = 1
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'account', NEW.id, 'account.archived',
          'Archived account: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_accounts_restored
      AFTER UPDATE OF is_archived ON accounts
      WHEN OLD.is_archived = 1 AND NEW.is_archived = 0
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'account', NEW.id, 'account.restored',
          'Restored account: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_accounts_deleted
      AFTER DELETE ON accounts
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'account', OLD.id, 'account.deleted',
          'Deleted account: ' || OLD.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_transactions_created
      AFTER INSERT ON transactions
      WHEN (NEW.type IN ('income', 'expense') OR (NEW.type = 'transfer' AND NEW.transfer_direction = 'out'))
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'transaction', NEW.id, 'transaction.created',
          'Added ' || NEW.type || ': ' || COALESCE(NULLIF(NEW.description, ''), 'Transaction'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_transactions_updated
      AFTER UPDATE ON transactions
      WHEN (OLD.account_id IS NOT NEW.account_id OR OLD.category_id IS NOT NEW.category_id
        OR OLD.type IS NOT NEW.type OR OLD.amount_minor IS NOT NEW.amount_minor
        OR OLD.description IS NOT NEW.description OR OLD.notes IS NOT NEW.notes
        OR OLD.occurred_at IS NOT NEW.occurred_at)
        AND OLD.deleted_at IS NEW.deleted_at
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'transaction', NEW.id, 'transaction.updated',
          'Updated transaction: ' || COALESCE(NULLIF(NEW.description, ''), 'Transaction'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_transactions_soft_deleted
      AFTER UPDATE OF deleted_at ON transactions
      WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'transaction', NEW.id, 'transaction.deleted',
          'Deleted transaction: ' || COALESCE(NULLIF(NEW.description, ''), 'Transaction'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_transactions_deleted
      AFTER DELETE ON transactions
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'transaction', OLD.id, 'transaction.deleted',
          'Deleted transaction: ' || COALESCE(NULLIF(OLD.description, ''), 'Transaction'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_budgets_created
      AFTER INSERT ON budgets
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'budget', NEW.id, 'budget.created',
          'Created budget for ' || COALESCE((SELECT name FROM categories WHERE id = NEW.category_id), 'a category'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_budgets_updated
      AFTER UPDATE ON budgets
      WHEN (OLD.category_id IS NOT NEW.category_id OR OLD.account_id IS NOT NEW.account_id
        OR OLD.period IS NOT NEW.period OR OLD.start_date IS NOT NEW.start_date
        OR OLD.end_date IS NOT NEW.end_date OR OLD.amount_minor IS NOT NEW.amount_minor
        OR OLD.rollover_enabled IS NOT NEW.rollover_enabled)
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'budget', NEW.id, 'budget.updated',
          'Updated budget for ' || COALESCE((SELECT name FROM categories WHERE id = NEW.category_id), 'a category'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_budgets_deleted
      AFTER DELETE ON budgets
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'budget', OLD.id, 'budget.deleted',
          'Deleted budget for ' || COALESCE((SELECT name FROM categories WHERE id = OLD.category_id), 'a category'),
          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_goals_created
      AFTER INSERT ON savings_goals
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'goal', NEW.id, 'goal.created',
          'Created savings goal: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_goals_updated
      AFTER UPDATE ON savings_goals
      WHEN (OLD.name IS NOT NEW.name OR OLD.target_amount_minor IS NOT NEW.target_amount_minor
        OR OLD.target_date IS NOT NEW.target_date OR OLD.account_id IS NOT NEW.account_id
        OR OLD.icon IS NOT NEW.icon OR OLD.color IS NOT NEW.color)
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'goal', NEW.id, 'goal.updated',
          'Updated savings goal: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_goals_status_updated
      AFTER UPDATE OF is_archived ON savings_goals
      WHEN OLD.is_archived IS NOT NEW.is_archived
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'goal', NEW.id, 'goal.status_updated',
          'Changed savings goal status: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_goals_deleted
      AFTER DELETE ON savings_goals
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'goal', OLD.id, 'goal.deleted',
          'Deleted savings goal: ' || OLD.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_goal_contributions_created
      AFTER INSERT ON goal_contributions
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'goal', NEW.goal_id, 'goal.contribution_recorded',
          'Recorded a savings contribution', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_loans_created
      AFTER INSERT ON loans
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'loan', NEW.id, 'loan.created',
          'Created loan: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_loans_updated
      AFTER UPDATE ON loans
      WHEN (OLD.name IS NOT NEW.name OR OLD.principal_minor IS NOT NEW.principal_minor
        OR OLD.monthly_interest_rate_bps IS NOT NEW.monthly_interest_rate_bps
        OR OLD.interest_type IS NOT NEW.interest_type OR OLD.term_months IS NOT NEW.term_months
        OR OLD.start_date IS NOT NEW.start_date OR OLD.due_date IS NOT NEW.due_date
        OR OLD.account_id IS NOT NEW.account_id OR OLD.notes IS NOT NEW.notes)
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'loan', NEW.id, 'loan.updated',
          'Updated loan: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_loans_status_updated
      AFTER UPDATE OF status ON loans
      WHEN OLD.status IS NOT NEW.status
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'loan', NEW.id, 'loan.status_updated',
          'Changed loan status: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_loans_deleted
      AFTER DELETE ON loans
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'loan', OLD.id, 'loan.deleted',
          'Deleted loan: ' || OLD.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_loan_payments_created
      AFTER INSERT ON loan_payments
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'loan', NEW.loan_id, 'loan.payment_recorded',
          'Recorded a loan payment', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_loan_payments_deleted
      AFTER DELETE ON loan_payments
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'loan', OLD.loan_id, 'loan.payment_deleted',
          'Deleted a loan payment', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_subscriptions_created
      AFTER INSERT ON subscriptions
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'subscription', NEW.id, 'subscription.created',
          'Created subscription: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_subscriptions_updated
      AFTER UPDATE ON subscriptions
      WHEN (OLD.name IS NOT NEW.name OR OLD.amount_minor IS NOT NEW.amount_minor
        OR OLD.billing_cycle IS NOT NEW.billing_cycle OR OLD.next_billing_date IS NOT NEW.next_billing_date
        OR OLD.account_id IS NOT NEW.account_id OR OLD.category_id IS NOT NEW.category_id)
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'subscription', NEW.id, 'subscription.updated',
          'Updated subscription: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_subscriptions_status_updated
      AFTER UPDATE OF is_active ON subscriptions
      WHEN OLD.is_active IS NOT NEW.is_active
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'subscription', NEW.id, 'subscription.status_updated',
          'Changed subscription status: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_subscriptions_deleted
      AFTER DELETE ON subscriptions
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'subscription', OLD.id, 'subscription.deleted',
          'Deleted subscription: ' || OLD.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_subscription_payments_created
      AFTER INSERT ON subscription_payments
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'subscription', NEW.subscription_id, 'subscription.payment_recorded',
          'Recorded a subscription payment', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_subscription_payments_deleted
      AFTER DELETE ON subscription_payments
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'subscription', OLD.subscription_id, 'subscription.payment_deleted',
          'Deleted a subscription payment', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_recurring_created
      AFTER INSERT ON recurring_rules
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'recurring', NEW.id, 'recurring.created',
          'Created recurring schedule: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_recurring_updated
      AFTER UPDATE ON recurring_rules
      WHEN (OLD.name IS NOT NEW.name OR OLD.type IS NOT NEW.type OR OLD.amount_minor IS NOT NEW.amount_minor
        OR OLD.account_id IS NOT NEW.account_id OR OLD.category_id IS NOT NEW.category_id
        OR OLD.frequency IS NOT NEW.frequency OR OLD.interval_count IS NOT NEW.interval_count
        OR OLD.start_date IS NOT NEW.start_date OR OLD.next_occurrence_date IS NOT NEW.next_occurrence_date
        OR OLD.end_date IS NOT NEW.end_date)
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'recurring', NEW.id, 'recurring.updated',
          'Updated recurring schedule: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_recurring_status_updated
      AFTER UPDATE OF is_active ON recurring_rules
      WHEN OLD.is_active IS NOT NEW.is_active
        AND NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'recurring', NEW.id, 'recurring.status_updated',
          'Changed recurring schedule status: ' || NEW.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;

      CREATE TRIGGER IF NOT EXISTS activity_recurring_deleted
      AFTER DELETE ON recurring_rules
      WHEN NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'backup_restore_in_progress' AND value = '1')
      BEGIN
        INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at)
        VALUES ('act-' || lower(hex(randomblob(16))), 'recurring', OLD.id, 'recurring.deleted',
          'Deleted recurring schedule: ' || OLD.name, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      END;
    
    `,
  },
  {
    version: 7,
    description: "Seed dedicated loan transaction categories",
    sql: `
      INSERT OR IGNORE INTO categories
        (id, name, type, icon, is_system, created_at, updated_at)
      VALUES
        ('cat-income-loan', 'Loan proceeds', 'income', 'cash-plus', 1,
          '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
        ('cat-expense-loan-payment', 'Loan payment', 'expense', 'cash-minus', 1,
          '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
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