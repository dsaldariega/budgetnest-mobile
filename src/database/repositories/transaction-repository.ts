import type { SQLiteDatabase } from "expo-sqlite";
import type { Transaction, TransactionType, TransferDirection } from "@/database/types";
import { assertPositiveMinorUnits } from "@/domain/money";
import { assertTransferAllowed, assertTransferPairIntegrity } from "@/domain/accounts";

type TransactionRow = {
  id: string; account_id: string; category_id: string | null; transfer_group_id: string | null;
  transfer_direction: TransferDirection | null; type: TransactionType; amount_minor: number;
  description: string; notes: string | null; occurred_at: string; created_at: string;
  updated_at: string; account_name: string; currency_code: string; category_name: string | null;
};

export type TransactionListItem = Transaction & {
  accountName: string; currencyCode: string; categoryName: string | null;
};

export function isLinkedTransactionId(id: string): boolean {
  return id.startsWith("loan-") || id.startsWith("loan-payment-") || id.startsWith("subscription-payment-");
}

function mapTransaction(row: TransactionRow): TransactionListItem {
  return {
    id: row.id, accountId: row.account_id, categoryId: row.category_id,
    transferGroupId: row.transfer_group_id, transferDirection: row.transfer_direction,
    type: row.type, amountMinor: row.amount_minor, description: row.description,
    notes: row.notes, occurredAt: row.occurred_at, createdAt: row.created_at,
    updatedAt: row.updated_at, accountName: row.account_name,
    currencyCode: row.currency_code, categoryName: row.category_name,
  };
}

export type CreateSimpleTransactionInput = {
  id: string; accountId: string; categoryId: string; type: "income" | "expense";
  amountMinor: number; description: string; notes?: string | null; occurredAt: string;
};

export type CreateTransferInput = {
  groupId: string; sourceAccountId: string; destinationAccountId: string;
  amountMinor: number; description?: string; notes?: string | null; occurredAt: string;
};

export function createTransactionRepository(db: SQLiteDatabase) {
  const selectSql = `SELECT t.*, a.name AS account_name, a.currency_code, c.name AS category_name
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN categories c ON c.id = t.category_id`;

  return {
    async listBetween(fromDate: string, toDate: string, limit = 500): Promise<TransactionListItem[]> {
      const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 500));
      const rows = await db.getAllAsync<TransactionRow>(`${selectSql} WHERE t.deleted_at IS NULL AND t.occurred_at >= ? AND t.occurred_at <= ? ORDER BY t.occurred_at DESC, t.created_at DESC LIMIT ?`, fromDate, toDate, safeLimit);
      return rows.map(mapTransaction);
    },
    async listRecent(limit = 100): Promise<TransactionListItem[]> {
      const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
      const rows = await db.getAllAsync<TransactionRow>(
        `${selectSql} WHERE t.deleted_at IS NULL ORDER BY t.occurred_at DESC, t.created_at DESC LIMIT ?`,
        safeLimit,
      );
      return rows.map(mapTransaction);
    },
    async getForHistory(historyId: string, kind: "income" | "expense" | "transfer"): Promise<TransactionListItem | null> {
      const where = kind === "transfer"
        ? "t.transfer_group_id = ? AND t.transfer_direction = 'out'"
        : "t.id = ?";
      const row = await db.getFirstAsync<TransactionRow>(
        `${selectSql} WHERE t.deleted_at IS NULL AND ${where}`,
        historyId,
      );
      return row ? mapTransaction(row) : null;
    },
    async listCategories(type: "income" | "expense", includeCategoryId?: string | null) {
      return db.getAllAsync<{ id: string; name: string }>(
        "SELECT id, name FROM categories WHERE type = ? AND (id = ? OR ((source_name IS NULL OR source_name <> 'subscription') AND id NOT IN ('cat-income-loan', 'cat-expense-savings'))) ORDER BY is_system DESC, name COLLATE NOCASE",
        type, includeCategoryId ?? null,
      );
    },
    async create(input: CreateSimpleTransactionInput): Promise<void> {
      assertPositiveMinorUnits(input.amountMinor);
      const account = await db.getFirstAsync<{ is_archived: number }>(
        "SELECT is_archived FROM accounts WHERE id = ?", input.accountId,
      );
      if (!account || account.is_archived) throw new Error("Choose an active account.");
      const category = await db.getFirstAsync<{ type: string }>(
        "SELECT type FROM categories WHERE id = ?", input.categoryId,
      );
      if (!category || category.type !== input.type) throw new Error("Choose a valid category.");
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO transactions (id, account_id, category_id, transfer_group_id, transfer_direction, type,
          amount_minor, description, notes, occurred_at, created_at, updated_at)
         VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        input.id, input.accountId, input.categoryId, input.type, input.amountMinor,
        input.description.trim(), input.notes ?? null, input.occurredAt, now, now,
      );
    },
    async createTransfer(input: CreateTransferInput): Promise<void> {
      assertPositiveMinorUnits(input.amountMinor);
      const [source, destination] = await Promise.all([
        db.getFirstAsync<{ currency_code: string; is_archived: number }>(
          "SELECT currency_code, is_archived FROM accounts WHERE id = ?", input.sourceAccountId,
        ),
        db.getFirstAsync<{ currency_code: string; is_archived: number }>(
          "SELECT currency_code, is_archived FROM accounts WHERE id = ?", input.destinationAccountId,
        ),
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
          `INSERT INTO transactions (id, account_id, category_id, transfer_group_id, transfer_direction, type,
            amount_minor, description, notes, occurred_at, created_at, updated_at)
           VALUES (?, ?, NULL, ?, 'out', 'transfer', ?, ?, ?, ?, ?, ?)`,
          input.groupId + "-out", input.sourceAccountId, input.groupId, input.amountMinor,
          input.description?.trim() || "Transfer", input.notes ?? null, input.occurredAt, now, now,
        );
        await db.runAsync(
          `INSERT INTO transactions (id, account_id, category_id, transfer_group_id, transfer_direction, type,
            amount_minor, description, notes, occurred_at, created_at, updated_at)
           VALUES (?, ?, NULL, ?, 'in', 'transfer', ?, ?, ?, ?, ?, ?)`,
          input.groupId + "-in", input.destinationAccountId, input.groupId, input.amountMinor,
          input.description?.trim() || "Transfer", input.notes ?? null, input.occurredAt, now, now,
        );
      });
    },
    async updateTransfer(id: string, input: Omit<CreateTransferInput, "groupId">): Promise<void> {
      const existing = await db.getFirstAsync<{ transfer_group_id: string | null }>(
        "SELECT transfer_group_id FROM transactions WHERE id = ? AND deleted_at IS NULL",
        id,
      );
      if (!existing?.transfer_group_id) throw new Error("Transfer was not found.");
      assertPositiveMinorUnits(input.amountMinor);
      const [source, destination] = await Promise.all([
        db.getFirstAsync<{ currency_code: string; is_archived: number }>(
          "SELECT currency_code, is_archived FROM accounts WHERE id = ?", input.sourceAccountId,
        ),
        db.getFirstAsync<{ currency_code: string; is_archived: number }>(
          "SELECT currency_code, is_archived FROM accounts WHERE id = ?", input.destinationAccountId,
        ),
      ]);
      if (!source || !destination) throw new Error("Choose two existing accounts.");
      assertTransferAllowed({
        sourceAccountId: input.sourceAccountId, destinationAccountId: input.destinationAccountId,
        sourceCurrency: source.currency_code, destinationCurrency: destination.currency_code,
        sourceArchived: source.is_archived === 1, destinationArchived: destination.is_archived === 1,
      });
      const now = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        const pair = await db.getAllAsync<{
          account_id: string;
          amount_minor: number;
          transfer_direction: TransferDirection | null;
        }>(
          "SELECT account_id, amount_minor, transfer_direction FROM transactions WHERE transfer_group_id = ? AND deleted_at IS NULL",
          existing.transfer_group_id,
        );
        assertTransferPairIntegrity(pair.map(entry => ({
          accountId: entry.account_id,
          amountMinor: entry.amount_minor,
          transferDirection: entry.transfer_direction,
        })));

        const outgoing = await db.runAsync(
          "UPDATE transactions SET account_id=?, amount_minor=?, description=?, notes=?, occurred_at=?, updated_at=? WHERE transfer_group_id=? AND transfer_direction='out' AND deleted_at IS NULL",
          input.sourceAccountId, input.amountMinor, input.description?.trim() || "Transfer", input.notes ?? null,
          input.occurredAt, now, existing.transfer_group_id,
        );
        const incoming = await db.runAsync(
          "UPDATE transactions SET account_id=?, amount_minor=?, description=?, notes=?, occurred_at=?, updated_at=? WHERE transfer_group_id=? AND transfer_direction='in' AND deleted_at IS NULL",
          input.destinationAccountId, input.amountMinor, input.description?.trim() || "Transfer", input.notes ?? null,
          input.occurredAt, now, existing.transfer_group_id,
        );
        if (outgoing.changes !== 1 || incoming.changes !== 1) {
          throw new Error("Transfer could not be updated because its entries are incomplete.");
        }
      });
    },
    async update(id: string, input: Omit<CreateSimpleTransactionInput, "id">): Promise<void> {
      if (isLinkedTransactionId(id)) throw new Error("Linked loan or subscription transactions must be changed from their source record.");
      assertPositiveMinorUnits(input.amountMinor);
      const account = await db.getFirstAsync<{ is_archived: number }>(
        "SELECT is_archived FROM accounts WHERE id = ?", input.accountId,
      );
      if (!account || account.is_archived) throw new Error("Choose an active account.");
      const category = await db.getFirstAsync<{ type: string }>(
        "SELECT type FROM categories WHERE id = ?", input.categoryId,
      );
      if (!category || category.type !== input.type) throw new Error("Choose a valid category.");
      const existing = await db.getFirstAsync<{ transfer_group_id: string | null; type: TransactionType }>(
        "SELECT transfer_group_id, type FROM transactions WHERE id = ? AND deleted_at IS NULL", id,
      );
      if (!existing) throw new Error("Transaction was not found.");
      if (existing.transfer_group_id || existing.type === "transfer") throw new Error("Use transfer editing for transfer transactions.");
      const now = new Date().toISOString();
      const result = await db.runAsync(
        "UPDATE transactions SET account_id=?, category_id=?, type=?, amount_minor=?, description=?, notes=?, occurred_at=?, updated_at=? WHERE id=? AND deleted_at IS NULL",
        input.accountId, input.categoryId, input.type, input.amountMinor, input.description.trim(), input.notes ?? null,
        input.occurredAt, now, id,
      );
      if (result.changes === 0) throw new Error("Transaction was not found.");
    },
    async delete(id: string): Promise<void> {
      if (isLinkedTransactionId(id)) throw new Error("Linked loan or subscription transactions must be deleted from their source record.");
      const row = await db.getFirstAsync<{ transfer_group_id: string | null }>(
        "SELECT transfer_group_id FROM transactions WHERE id = ? AND deleted_at IS NULL", id,
      );
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
