import type { SQLiteDatabase } from "expo-sqlite";
import type { Account, AccountType, CreateAccountInput } from "@/database/types";

type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  currency_code: string;
  opening_balance_minor: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
};

function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currencyCode: row.currency_code,
    openingBalanceMinor: row.opening_balance_minor,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createAccountRepository(db: SQLiteDatabase) {
  return {
    async list(): Promise<Account[]> {
      const rows = await db.getAllAsync<AccountRow>(
        "SELECT * FROM accounts WHERE is_archived = 0 ORDER BY name COLLATE NOCASE ASC",
      );
      return rows.map(mapAccount);
    },

    async findById(id: string): Promise<Account | null> {
      const row = await db.getFirstAsync<AccountRow>(
        "SELECT * FROM accounts WHERE id = ?",
        id,
      );
      return row ? mapAccount(row) : null;
    },

    async create(input: CreateAccountInput): Promise<Account> {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO accounts (
          id, name, type, currency_code, opening_balance_minor,
          is_archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        input.id,
        input.name.trim(),
        input.type,
        input.currencyCode.toUpperCase(),
        input.openingBalanceMinor,
        now,
        now,
      );

      const created = await this.findById(input.id);
      if (!created) {
        throw new Error("Account was created but could not be retrieved.");
      }
      return created;
    },

    async archive(id: string): Promise<void> {
      await db.runAsync(
        "UPDATE accounts SET is_archived = 1, updated_at = ? WHERE id = ?",
        new Date().toISOString(),
        id,
      );
    },
  };
}
