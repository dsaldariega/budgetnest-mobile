import type { SQLiteDatabase } from "expo-sqlite";
import { assertPositiveMinorUnits } from "@/domain/money";
import { compareDates } from "@/domain/dates";

export type SavingsGoalListItem = {
  id: string; name: string; targetAmountMinor: number; currentAmountMinor: number;
  remainingMinor: number; progress: number; targetDate: string | null; accountId: string;
  accountName: string; currencyCode: string; icon: string | null; color: string | null;
  isArchived: boolean; createdAt: string; updatedAt: string;
};

export type CreateGoalInput = {
  id: string; name: string; targetAmountMinor: number; targetDate?: string | null;
  accountId: string; icon?: string | null; color?: string | null;
};

export type CreateContributionInput = {
  id: string; goalId: string; amountMinor: number; contributedAt: string; note?: string | null;
};

export function createGoalRepository(db: SQLiteDatabase) {
  async function list(includeArchived = false): Promise<SavingsGoalListItem[]> {
    const rows = await db.getAllAsync<{
      id: string; name: string; target_amount_minor: number; target_date: string | null;
      account_id: string; account_name: string; currency_code: string; icon: string | null;
      color: string | null; is_archived: number; legacy_current_amount_minor: number | null;
      created_at: string; updated_at: string;
    }>(
      "SELECT g.*, a.name AS account_name, a.currency_code FROM savings_goals g " +
      "JOIN accounts a ON a.id = g.account_id " +
      (includeArchived ? "" : "WHERE g.is_archived = 0 ") +
      "ORDER BY g.is_archived ASC, g.target_date IS NULL, g.target_date ASC, g.name COLLATE NOCASE ASC",
    );
    return Promise.all(rows.map(async row => {
      const contributions = await db.getFirstAsync<{ total_minor: number | null }>(
        "SELECT COALESCE(SUM(amount_minor), 0) AS total_minor FROM goal_contributions WHERE goal_id = ?",
        row.id,
      );
      const currentAmountMinor = (row.legacy_current_amount_minor ?? 0) + (contributions?.total_minor ?? 0);
      return {
        id: row.id, name: row.name, targetAmountMinor: row.target_amount_minor,
        currentAmountMinor, remainingMinor: Math.max(0, row.target_amount_minor - currentAmountMinor),
        progress: Math.min(1, currentAmountMinor / row.target_amount_minor),
        targetDate: row.target_date, accountId: row.account_id, accountName: row.account_name,
        currencyCode: row.currency_code, icon: row.icon, color: row.color,
        isArchived: row.is_archived === 1, createdAt: row.created_at, updatedAt: row.updated_at,
      };
    }));
  }

  return {
    list,
    async update(id: string, input: Omit<CreateGoalInput, "id">): Promise<void> {
      assertPositiveMinorUnits(input.targetAmountMinor);
      if (!input.name.trim()) throw new Error("Enter a goal name.");
      if (input.targetDate) compareDates(input.targetDate, input.targetDate);
      const account = await db.getFirstAsync<{ is_archived: number }>(
        "SELECT is_archived FROM accounts WHERE id = ?", input.accountId,
      );
      if (!account || account.is_archived) throw new Error("Choose an active account.");
      const result = await db.runAsync(
        "UPDATE savings_goals SET name = ?, target_amount_minor = ?, target_date = ?, account_id = ?, updated_at = ? WHERE id = ? AND is_archived = 0",
        input.name.trim(), input.targetAmountMinor, input.targetDate ?? null, input.accountId, new Date().toISOString(), id,
      );
      if (result.changes === 0) throw new Error("Goal was not found or is archived.");
    },
    async create(input: CreateGoalInput): Promise<void> {
      assertPositiveMinorUnits(input.targetAmountMinor);
      if (!input.name.trim()) throw new Error("Enter a goal name.");
      if (input.targetDate) compareDates(input.targetDate, input.targetDate);
      const account = await db.getFirstAsync<{ is_archived: number }>(
        "SELECT is_archived FROM accounts WHERE id = ?", input.accountId,
      );
      if (!account || account.is_archived) throw new Error("Choose an active account.");
      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO savings_goals (id, name, target_amount_minor, target_date, account_id, icon, color, is_archived, legacy_current_amount_minor, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)",
        input.id, input.name.trim(), input.targetAmountMinor, input.targetDate ?? null,
        input.accountId, input.icon ?? null, input.color ?? null, now, now,
      );
    },
    async addContribution(input: CreateContributionInput): Promise<void> {
      assertPositiveMinorUnits(input.amountMinor);
      const goal = await db.getFirstAsync<{ is_archived: number }>(
        "SELECT is_archived FROM savings_goals WHERE id = ?", input.goalId,
      );
      if (!goal || goal.is_archived) throw new Error("Choose an active goal.");
      await db.runAsync(
        "INSERT INTO goal_contributions (id, goal_id, amount_minor, contributed_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        input.id, input.goalId, input.amountMinor, input.contributedAt, input.note ?? null, new Date().toISOString(),
      );
    },
    async getDeleteImpact(id: string): Promise<{ contributions: number }> {
      const goal = await db.getFirstAsync<{ id: string }>("SELECT id FROM savings_goals WHERE id = ?", id);
      if (!goal) throw new Error("Goal was not found.");
      const row = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM goal_contributions WHERE goal_id = ?", id,
      );
      return { contributions: row?.count ?? 0 };
    },
    async delete(id: string): Promise<void> {
      const goal = await db.getFirstAsync<{ id: string }>("SELECT id FROM savings_goals WHERE id = ?", id);
      if (!goal) throw new Error("Goal was not found.");
      await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM goal_contributions WHERE goal_id = ?", id);
        const result = await db.runAsync("DELETE FROM savings_goals WHERE id = ?", id);
        if (result.changes === 0) throw new Error("Goal was not found.");
      });
    },
    async archive(id: string): Promise<void> {
      const result = await db.runAsync(
        "UPDATE savings_goals SET is_archived = 1, updated_at = ? WHERE id = ? AND is_archived = 0",
        new Date().toISOString(), id,
      );
      if (result.changes === 0) throw new Error("Goal could not be found or is already archived.");
    },
  };
}
