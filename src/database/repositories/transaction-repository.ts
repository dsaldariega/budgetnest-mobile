import type { SQLiteDatabase } from "expo-sqlite";
import type {
  CreateTransactionInput,
  Transaction,
  TransactionType,
} from "@/database/types";

type TransactionRow = {
  id: string;
  account_id: string;
  category_id: string | null;
  transfer_group_id: string | null;
  type: TransactionType;
  amount_minor: number;
  description: string;
  notes: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    transferGroupId: row.transfer_group_id,
    type: row.type,
    amountMinor: row.amount_minor,
    description: row.description,
    notes: row.notes,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTransactionRepository(db: SQLiteDatabase) {
  return {
    async listRecent(limit = 50): Promise<Transaction[]> {
      const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
      const rows = await db.getAllAsync<TransactionRow>(
        "SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY occurred_at DESC LIMIT ?",
        safeLimit,
      );
      return rows.map(mapTransaction);
    },

    async create(input: CreateTransactionInput): Promise<Transaction> {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO transactions (
          id, account_id, category_id, transfer_group_id, type,
          amount_minor, description, notes, occurred_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        input.id,
        input.accountId,
        input.categoryId,
        input.transferGroupId,
        input.type,
        input.amountMinor,
        input.description.trim(),
        input.notes,
        input.occurredAt,
        now,
        now,
      );

      const row = await db.getFirstAsync<TransactionRow>(
        "SELECT * FROM transactions WHERE id = ?",
        input.id,
      );
      if (!row) {
        throw new Error("Transaction was created but could not be retrieved.");
      }
      return mapTransaction(row);
    },
  };
}
