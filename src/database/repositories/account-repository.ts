import type { SQLiteDatabase } from "expo-sqlite";
import type { Account, AccountType, CreateAccountInput, SourceAccountType } from "@/database/types";

type AccountRow = {
  id: string; name: string; type: Exclude<AccountType, "investment">;
  source_type: SourceAccountType | null; currency_code: string;
  opening_balance_minor: number; is_archived: number; created_at: string; updated_at: string;
};

export type AccountWithBalance = Account & { balanceMinor: number };

function mapAccount(row: AccountRow): Account {
  const type: AccountType = row.source_type === "investment" ? "investment" : row.type;
  return {
    id: row.id, name: row.name, type, sourceType: row.source_type,
    currencyCode: row.currency_code, openingBalanceMinor: row.opening_balance_minor,
    isArchived: row.is_archived === 1, createdAt: row.created_at, updatedAt: row.updated_at,
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
    async create(input: CreateAccountInput): Promise<Account> {
      const name = input.name.trim();
      const currency = input.currencyCode.trim().toUpperCase();
      if (!name) throw new Error("Enter an account name.");
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Enter a valid 3-letter currency code.");
      if (!Number.isSafeInteger(input.openingBalanceMinor)) throw new Error("Opening balance is invalid.");
      const storedType = input.type === "investment" ? "other" : input.type;
      const sourceType = input.sourceType ?? (input.type === "investment" ? "investment" : input.type === "credit_card" ? "credit" : null);
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
    async archive(id: string): Promise<void> {
      const result = await db.runAsync(
        "UPDATE accounts SET is_archived = 1, updated_at = ? WHERE id = ? AND is_archived = 0",
        new Date().toISOString(), id,
      );
      if (result.changes === 0) throw new Error("Account could not be found or is already archived.");
    },
  };
}
