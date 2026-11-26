import type { SQLiteDatabase } from "expo-sqlite";
import type { Account, AccountType, CreateAccountInput, SourceAccountType } from "@/database/types";

type AccountRow = {
  id: string;
  name: string;
  type: Exclude<AccountType, "investment">;
  source_type: SourceAccountType | null;
  currency_code: string;
  opening_balance_minor: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
};

export type AccountWithBalance = Account & { balanceMinor: number };

export type AccountDeleteImpact = {
  transactions: number;
  budgets: number;
  goals: number;
  goalContributions: number;
  loans: number;
  loanPayments: number;
  subscriptions: number;
  subscriptionPayments: number;
  recurringRules: number;
};

export function getAccountDeleteImpactCount(impact: AccountDeleteImpact): number {
  return Object.values(impact).reduce((total, count) => total + count, 0);
}

function mapAccount(row: AccountRow): Account {
  const type: AccountType = row.source_type === "investment" ? "investment" : row.type;
  return {
    id: row.id,
    name: row.name,
    type,
    sourceType: row.source_type,
    currencyCode: row.currency_code,
    openingBalanceMinor: row.opening_balance_minor,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateInput(input: CreateAccountInput): {
  name: string;
  currency: string;
  storedType: Exclude<AccountType, "investment">;
  sourceType: SourceAccountType;
} {
  const name = input.name.trim();
  const currency = input.currencyCode.trim().toUpperCase();

  if (!name) throw new Error("Enter an account name.");
  if (name.length > 80) throw new Error("Account names must be 80 characters or fewer.");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Enter a valid 3-letter currency code.");
  if (!Number.isSafeInteger(input.openingBalanceMinor)) throw new Error("Opening balance is invalid.");

  return {
    name,
    currency,
    storedType: input.type === "investment" ? "other" : input.type,
    sourceType: input.sourceType ?? (
      input.type === "investment" ? "investment" :
      input.type === "credit_card" ? "credit" :
      input.type
    ),
  };
}

export function createAccountRepository(db: SQLiteDatabase) {
  async function listWithBalances(includeArchived = false): Promise<AccountWithBalance[]> {
    const rows = await db.getAllAsync<AccountRow & { balance_minor: number }>(
      `SELECT a.*, a.opening_balance_minor
        + COALESCE(SUM(CASE
          WHEN t.deleted_at IS NOT NULL THEN 0
          WHEN t.type = 'income' THEN t.amount_minor
          WHEN t.type = 'expense' THEN -t.amount_minor
          WHEN t.type = 'transfer' AND t.transfer_direction = 'in' THEN t.amount_minor
          WHEN t.type = 'transfer' AND t.transfer_direction = 'out' THEN -t.amount_minor
          ELSE 0 END), 0) AS balance_minor
       FROM accounts a
       LEFT JOIN transactions t ON t.account_id = a.id
       ${includeArchived ? "" : "WHERE a.is_archived = 0"}
       GROUP BY a.id
       ORDER BY a.is_archived ASC, a.name COLLATE NOCASE ASC`,
    );
    return rows.map(row => ({ ...mapAccount(row), balanceMinor: row.balance_minor }));
  }

  return {
    list: () => listWithBalances(false),
    listAll: () => listWithBalances(true),

    async findById(id: string): Promise<Account | null> {
      const row = await db.getFirstAsync<AccountRow>("SELECT * FROM accounts WHERE id = ?", id);
      return row ? mapAccount(row) : null;
    },

    async getDeleteImpact(id: string): Promise<AccountDeleteImpact> {
      const [transactions, budgets, goals, goalContributions, loans, loanPayments, subscriptions, subscriptionPayments, recurringRules] = await Promise.all([
        db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM transactions WHERE account_id = ?", id),
        db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM budgets WHERE account_id = ?", id),
        db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM savings_goals WHERE account_id = ?", id),
        db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM goal_contributions WHERE goal_id IN (SELECT id FROM savings_goals WHERE account_id = ?)", id),
        db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM loans WHERE account_id = ?", id),
        db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM loan_payments WHERE loan_id IN (SELECT id FROM loans WHERE account_id = ?)", id),
        db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM subscriptions WHERE account_id = ?", id),
        db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM subscription_payments WHERE subscription_id IN (SELECT id FROM subscriptions WHERE account_id = ?)", id),
        db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM recurring_rules WHERE account_id = ?", id),
      ]);

      return {
        transactions: transactions?.count ?? 0,
        budgets: budgets?.count ?? 0,
        goals: goals?.count ?? 0,
        goalContributions: goalContributions?.count ?? 0,
        loans: loans?.count ?? 0,
        loanPayments: loanPayments?.count ?? 0,
        subscriptions: subscriptions?.count ?? 0,
        subscriptionPayments: subscriptionPayments?.count ?? 0,
        recurringRules: recurringRules?.count ?? 0,
      };
    },

    async create(input: CreateAccountInput): Promise<Account> {
      const { name, currency, storedType, sourceType } = validateInput(input);
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO accounts (id, name, type, source_type, currency_code, opening_balance_minor, is_archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        input.id, name, storedType, sourceType, currency, input.openingBalanceMinor, now, now,
      );
      const created = await this.findById(input.id);
      if (!created) throw new Error("Account was created but could not be retrieved.");
      return created;
    },

    async update(id: string, input: CreateAccountInput): Promise<Account> {
      const { name, currency, storedType, sourceType } = validateInput(input);
      const result = await db.runAsync(
        `UPDATE accounts
         SET name = ?, type = ?, source_type = ?, currency_code = ?,
             opening_balance_minor = ?, updated_at = ?
         WHERE id = ?`,
        name, storedType, sourceType, currency, input.openingBalanceMinor,
        new Date().toISOString(), id,
      );
      if (result.changes === 0) throw new Error("Account could not be found.");
      const updated = await this.findById(id);
      if (!updated) throw new Error("Account was updated but could not be retrieved.");
      return updated;
    },

    async setArchived(id: string, archived: boolean): Promise<void> {
      const result = await db.runAsync(
        "UPDATE accounts SET is_archived = ?, updated_at = ? WHERE id = ?",
        archived ? 1 : 0, new Date().toISOString(), id,
      );
      if (result.changes === 0) throw new Error("Account could not be found.");
    },

    async delete(id: string): Promise<void> {
      const account = await db.getFirstAsync<{ id: string }>("SELECT id FROM accounts WHERE id = ?", id);
      if (!account) throw new Error("Account could not be found.");

      await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM transactions WHERE account_id = ?", id);
        await db.runAsync("DELETE FROM budgets WHERE account_id = ?", id);
        await db.runAsync("DELETE FROM goal_contributions WHERE goal_id IN (SELECT id FROM savings_goals WHERE account_id = ?)", id);
        await db.runAsync("DELETE FROM loan_payments WHERE loan_id IN (SELECT id FROM loans WHERE account_id = ?)", id);
        await db.runAsync("DELETE FROM subscription_payments WHERE subscription_id IN (SELECT id FROM subscriptions WHERE account_id = ?)", id);
        await db.runAsync("DELETE FROM recurring_rules WHERE account_id = ?", id);
        await db.runAsync("DELETE FROM savings_goals WHERE account_id = ?", id);
        await db.runAsync("DELETE FROM loans WHERE account_id = ?", id);
        await db.runAsync("DELETE FROM subscriptions WHERE account_id = ?", id);
        const result = await db.runAsync("DELETE FROM accounts WHERE id = ?", id);
        if (result.changes === 0) throw new Error("Account could not be found.");
      });
    },
  };
}
