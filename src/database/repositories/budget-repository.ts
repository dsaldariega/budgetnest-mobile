import type { SQLiteDatabase } from "expo-sqlite";
import { getBudgetWindow, type BudgetPeriod } from "@/domain/budgets";
import { assertPositiveMinorUnits } from "@/domain/money";

export type BudgetListItem = {
  id: string; name: string; categoryId: string; categoryName: string; accountId: string;
  accountName: string; currencyCode: string; period: BudgetPeriod; startDate: string;
  endDate: string | null; amountMinor: number; spentMinor: number; remainingMinor: number;
  progress: number; rolloverEnabled: boolean; createdAt: string; updatedAt: string;
};

export type CreateBudgetInput = {
  id: string; name: string; categoryId: string; accountId: string; period: BudgetPeriod;
  startDate: string; endDate?: string | null; amountMinor: number; rolloverEnabled?: boolean;
};

export function createBudgetRepository(db: SQLiteDatabase) {
  async function list(referenceDate: string): Promise<BudgetListItem[]> {
    const rows = await db.getAllAsync<{
      id: string; category_id: string; category_name: string; account_id: string;
      account_name: string; currency_code: string; period: BudgetPeriod;
      start_date: string; end_date: string | null; amount_minor: number;
      rollover_enabled: number; created_at: string; updated_at: string;
    }>(
      "SELECT b.*, c.name AS category_name, a.name AS account_name, a.currency_code " +
      "FROM budgets b JOIN categories c ON c.id = b.category_id " +
      "JOIN accounts a ON a.id = b.account_id " +
      "ORDER BY b.start_date DESC, c.name COLLATE NOCASE ASC",
    );
    return Promise.all(rows.map(async row => {
      const window = getBudgetWindow({
        period: row.period, startDate: row.start_date, endDate: row.end_date, referenceDate,
      });
      const spent = await db.getFirstAsync<{ spent_minor: number | null }>(
        "SELECT COALESCE(SUM(amount_minor), 0) AS spent_minor FROM transactions " +
        "WHERE account_id = ? AND category_id = ? AND type = 'expense' " +
        "AND deleted_at IS NULL AND occurred_at BETWEEN ? AND ?",
        row.account_id, row.category_id, window.startDate, window.endDate,
      );
      const spentMinor = spent?.spent_minor ?? 0;
      return {
        id: row.id, name: row.name || row.category_name, categoryId: row.category_id, categoryName: row.category_name,
        accountId: row.account_id, accountName: row.account_name, currencyCode: row.currency_code,
        period: row.period, startDate: row.start_date, endDate: row.end_date,
        amountMinor: row.amount_minor, spentMinor, remainingMinor: row.amount_minor - spentMinor,
        progress: Math.min(1, spentMinor / row.amount_minor),
        rolloverEnabled: row.rollover_enabled === 1, createdAt: row.created_at, updatedAt: row.updated_at,
      };
    }));
  }

  return {
    list,
    async create(input: CreateBudgetInput): Promise<void> {
      assertPositiveMinorUnits(input.amountMinor);
      const account = await db.getFirstAsync<{ is_archived: number }>(
        "SELECT is_archived FROM accounts WHERE id = ?", input.accountId,
      );
      if (!account || account.is_archived) throw new Error("Choose an active account.");
      const category = await db.getFirstAsync<{ type: string }>(
        "SELECT type FROM categories WHERE id = ?", input.categoryId,
      );
      if (!category || category.type !== "expense") throw new Error("Choose an expense category.");
      getBudgetWindow({
        period: input.period, startDate: input.startDate, endDate: input.endDate, referenceDate: input.startDate,
      });
      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO budgets (id, name, category_id, account_id, period, start_date, end_date, amount_minor, rollover_enabled, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        input.id, input.name.trim(), input.categoryId, input.accountId, input.period, input.startDate,
        input.endDate ?? null, input.amountMinor, input.rolloverEnabled ? 1 : 0, now, now,
      );
    },
    async update(input: CreateBudgetInput): Promise<void> {
      assertPositiveMinorUnits(input.amountMinor);
      const account = await db.getFirstAsync<{ is_archived: number }>("SELECT is_archived FROM accounts WHERE id = ?", input.accountId);
      if (!account || account.is_archived) throw new Error("Choose an active account.");
      const category = await db.getFirstAsync<{ type: string }>("SELECT type FROM categories WHERE id = ?", input.categoryId);
      if (!category || category.type !== "expense") throw new Error("Choose an expense category.");
      getBudgetWindow({ period: input.period, startDate: input.startDate, endDate: input.endDate, referenceDate: input.startDate });
      const result = await db.runAsync(
        "UPDATE budgets SET name=?, category_id=?, account_id=?, period=?, start_date=?, end_date=?, amount_minor=?, rollover_enabled=?, updated_at=? WHERE id=?",
        input.name.trim(), input.categoryId, input.accountId, input.period, input.startDate, input.endDate ?? null,
        input.amountMinor, input.rolloverEnabled ? 1 : 0, new Date().toISOString(), input.id,
      );
      if (result.changes === 0) throw new Error("Budget was not found.");
    },
    async delete(id: string): Promise<void> {
      const result = await db.runAsync("DELETE FROM budgets WHERE id = ?", id);
      if (result.changes === 0) throw new Error("Budget was not found.");
    },
  };
}
