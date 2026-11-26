import type { SQLiteDatabase } from "expo-sqlite";
import type { Transaction, TransactionType, TransferDirection } from "@/database/types";
import { assertPositiveMinorUnits } from "@/domain/money";
import { assertTransferAllowed } from "@/domain/accounts";

type TransactionRow = {
  id: string; account_id: string; category_id: string | null; transfer_group_id: string | null;
  transfer_direction: TransferDirection | null; type: TransactionType; amount_minor: number;
  description: string; notes: string | null; occurred_at: string; created_at: string;
  updated_at: string; account_name: string; currency_code: string; category_name: string | null;
};

export type TransactionListItem = Transaction & {
  accountName: string; currencyCode: string; categoryName: string | null;
};

function mapTransaction(row: TransactionRow): TransactionListItem {
  return {
    id: row.id, accountId: row.account_id, categoryId: row.category_id,
    transferGroupId: row.transfer_group_id, transferDirection: row.transfer_direction,
    type: row.type, amountMinor: row.amount_minor, description: row.description,
    notes: row.notes, occurredAt: row.occurred_at, createdAt: row.created_at,
    updatedAt: row.updated_at, accountName: row.account_name, currencyCode: row.currency_code,
    categoryName: row.category_name,
  };
}

export type CreateSimpleTransactionInput = {
  id: string; accountId: string; categoryId: string; type: "income" | "expense";
  amountMinor: number; description: string; notes?: string | null; occurredAt: string;
};
export type UpdateSimpleTransactionInput = Omit<CreateSimpleTransactionInput, "id">;
export type CreateTransferInput = {
  groupId: string; sourceAccountId: string; destinationAccountId: string;
  amountMinor: number; description?: string; notes?: string | null; occurredAt: string;
};
export type UpdateTransferInput = Omit<CreateTransferInput, "groupId">;

export function createTransactionRepository(db: SQLiteDatabase) {
  const selectSql = `SELECT t.*, a.name AS account_name, a.currency_code, c.name AS category_name
    FROM transactions t JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id`;

  async function validateSimple(input: CreateSimpleTransactionInput | UpdateSimpleTransactionInput) {
    assertPositiveMinorUnits(input.amountMinor);
    if (!input.description.trim()) throw new Error("Enter a transaction name.");
    const account = await db.getFirstAsync<{ is_archived: number }>("SELECT is_archived FROM accounts WHERE id = ?", input.accountId);
    if (!account || account.is_archived) throw new Error("Choose an active account.");
    const category = await db.getFirstAsync<{ type: string }>("SELECT type FROM categories WHERE id = ?", input.categoryId);
    if (!category || category.type !== input.type) throw new Error("Choose a valid category.");
  }

  return {
    async listRecent(limit = 100): Promise<TransactionListItem[]> {
      const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
      const rows = await db.getAllAsync<TransactionRow>(`${selectSql} WHERE t.deleted_at IS NULL ORDER BY t.occurred_at DESC, t.created_at DESC LIMIT ?`, safeLimit);
      return rows.map(mapTransaction);
    },
    async findById(id: string): Promise<TransactionListItem | null> {
      const row = await db.getFirstAsync<TransactionRow>(`${selectSql} WHERE t.id = ? AND t.deleted_at IS NULL`, id);
      return row ? mapTransaction(row) : null;
    },
    async listCategories(type: "income" | "expense") {
      return db.getAllAsync<{ id: string; name: string }>(
        "SELECT id, name FROM categories WHERE type = ? ORDER BY is_system DESC, name COLLATE NOCASE", type,
      );
    },
    async create(input: CreateSimpleTransactionInput): Promise<void> {
      await validateSimple(input);
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO transactions (id, account_id, category_id, transfer_group_id, transfer_direction, type, amount_minor, description, notes, occurred_at, created_at, updated_at)
         VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        input.id, input.accountId, input.categoryId, input.type, input.amountMinor,
        input.description.trim(), input.notes?.trim() || null, input.occurredAt, now, now,
      );
    },
    async update(id: string, input: UpdateSimpleTransactionInput): Promise<void> {
      await validateSimple({ ...input, id });
      const row = await db.getFirstAsync<{ type: TransactionType; transfer_group_id: string | null }>(
        "SELECT type, transfer_group_id FROM transactions WHERE id = ? AND deleted_at IS NULL", id,
      );
      if (!row) throw new Error("Transaction was not found.");
      if (row.type === "transfer" || row.transfer_group_id) throw new Error("Edit transfers from the transfer editor.");
      const result = await db.runAsync(
        "UPDATE transactions SET account_id=?, category_id=?, type=?, amount_minor=?, description=?, notes=?, occurred_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL",
        input.accountId, input.categoryId, input.type, input.amountMinor, input.description.trim(),
        input.notes?.trim() || null, input.occurredAt, new Date().toISOString(), id,
      );
      if (result.changes === 0) throw new Error("Transaction was not found.");
    },
    async createTransfer(input: CreateTransferInput): Promise<void> {
      assertPositiveMinorUnits(input.amountMinor);
      if (!input.description?.trim()) throw new Error("Enter a transaction name.");
      const [source, destination] = await Promise.all([
        db.getFirstAsync<{ currency_code: string; is_archived: number }>("SELECT currency_code, is_archived FROM accounts WHERE id = ?", input.sourceAccountId),
        db.getFirstAsync<{ currency_code: string; is_archived: number }>("SELECT currency_code, is_archived FROM accounts WHERE id = ?", input.destinationAccountId),
      ]);
      if (!source || !destination) throw new Error("Choose two existing accounts.");
      assertTransferAllowed({
        sourceAccountId: input.sourceAccountId, destinationAccountId: input.destinationAccountId,
        sourceCurrency: source.currency_code, destinationCurrency: destination.currency_code,
        sourceArchived: source.is_archived === 1, destinationArchived: destination.is_archived === 1,
      });
      const now = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT INTO transactions (id, account_id, category_id, transfer_group_id, transfer_direction, type, amount_minor, description, notes, occurred_at, created_at, updated_at)
           VALUES (?, ?, NULL, ?, 'out', 'transfer', ?, ?, ?, ?, ?, ?)`,
          input.groupId + "-out", input.sourceAccountId, input.groupId, input.amountMinor, input.description.trim(), input.notes?.trim() || null, input.occurredAt, now, now,
        );
        await db.runAsync(
          `INSERT INTO transactions (id, account_id, category_id, transfer_group_id, transfer_direction, type, amount_minor, description, notes, occurred_at, created_at, updated_at)
           VALUES (?, ?, NULL, ?, 'in', 'transfer', ?, ?, ?, ?, ?, ?)`,
          input.groupId + "-in", input.destinationAccountId, input.groupId, input.amountMinor, input.description.trim(), input.notes?.trim() || null, input.occurredAt, now, now,
        );
      });
    },
    async updateTransfer(id: string, input: UpdateTransferInput): Promise<void> {
      assertPositiveMinorUnits(input.amountMinor);
      if (!input.description.trim()) throw new Error("Enter a transaction name.");
      const existing = await db.getFirstAsync<{ transfer_group_id: string | null }>(
        "SELECT transfer_group_id FROM transactions WHERE id = ? AND deleted_at IS NULL", id,
      );
      if (!existing?.transfer_group_id) throw new Error("Transfer was not found.");
      const groupId = existing.transfer_group_id;
      const [source, destination] = await Promise.all([
        db.getFirstAsync<{ id: string; currency_code: string; is_archived: number }>("SELECT id,currency_code,is_archived FROM accounts WHERE id = (SELECT account_id FROM transactions WHERE transfer_group_id=? AND transfer_direction='out' LIMIT 1)", groupId),
        db.getFirstAsync<{ id: string; currency_code: string; is_archived: number }>("SELECT id,currency_code,is_archived FROM accounts WHERE id = (SELECT account_id FROM transactions WHERE transfer_group_id=? AND transfer_direction='in' LIMIT 1)", groupId),
      ]);
      if (!source || !destination) throw new Error("Transfer accounts could not be found.");
      const nextSource = input.sourceAccountId;
      const nextDestination = input.destinationAccountId;
      const [sourceNext, destinationNext] = await Promise.all([
        db.getFirstAsync<{ currency_code: string; is_archived: number }>("SELECT currency_code,is_archived FROM accounts WHERE id=?", nextSource),
        db.getFirstAsync<{ currency_code: string; is_archived: number }>("SELECT currency_code,is_archived FROM accounts WHERE id=?", nextDestination),
      ]);
      if (!sourceNext || !destinationNext) throw new Error("Choose two existing accounts.");
      assertTransferAllowed({
        sourceAccountId: nextSource, destinationAccountId: nextDestination,
        sourceCurrency: sourceNext.currency_code, destinationCurrency: destinationNext.currency_code,
        sourceArchived: sourceNext.is_archived === 1, destinationArchived: destinationNext.is_archived === 1,
      });
      const now = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        await db.runAsync("UPDATE transactions SET account_id=?, amount_minor=?, description=?, notes=?, occurred_at=?, updated_at=? WHERE transfer_group_id=? AND transfer_direction='out' AND deleted_at IS NULL",
          nextSource, input.amountMinor, input.description.trim(), input.notes?.trim() || null, input.occurredAt, now, groupId);
        await db.runAsync("UPDATE transactions SET account_id=?, amount_minor=?, description=?, notes=?, occurred_at=?, updated_at=? WHERE transfer_group_id=? AND transfer_direction='in' AND deleted_at IS NULL",
          nextDestination, input.amountMinor, input.description.trim(), input.notes?.trim() || null, input.occurredAt, now, groupId);
      });
    },
    async delete(id: string): Promise<void> {
      const row = await db.getFirstAsync<{ transfer_group_id: string | null }>("SELECT transfer_group_id FROM transactions WHERE id = ? AND deleted_at IS NULL", id);
      if (!row) throw new Error("Transaction was not found.");
      const now = new Date().toISOString();
      if (row.transfer_group_id) {
        await db.runAsync("UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE transfer_group_id = ? AND deleted_at IS NULL", now, now, row.transfer_group_id);
      } else {
        await db.runAsync("UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ?", now, now, id);
      }
    },
  };
}
