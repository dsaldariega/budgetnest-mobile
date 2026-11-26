import type { SQLiteDatabase } from "expo-sqlite";
import {
  BACKUP_TABLES,
  createBackupPayload,
  parseBackup,
  serializeBackup,
  type BackupData,
  type BudgetNestBackup,
} from "./backup-format";

const restoreOrder = [
  "activity_logs", "loan_payments", "subscription_payments", "goal_contributions",
  "transactions", "loans", "subscriptions", "budgets", "savings_goals",
  "categories", "accounts", "app_settings",
] as const;

const insertOrder = [
  "accounts", "categories", "transactions", "budgets", "savings_goals",
  "goal_contributions", "subscriptions", "subscription_payments", "loans",
  "loan_payments", "activity_logs", "app_settings",
] as const;

export function createBackupRepository(db: SQLiteDatabase) {
  return {
    async createBackup(): Promise<BudgetNestBackup> {
      const data = {} as BackupData;
      for (const table of BACKUP_TABLES) {
        data[table] = await db.getAllAsync<Record<string, unknown>>(
          `SELECT * FROM ${table}`,
        );
      }
      return createBackupPayload(data);
    },

    async exportJson(): Promise<string> {
      return serializeBackup(await this.createBackup());
    },

    async restoreJson(text: string): Promise<void> {
      const backup = parseBackup(text);

      await db.withTransactionAsync(async () => {
        for (const table of restoreOrder) {
          await db.runAsync(`DELETE FROM ${table}`);
        }

        for (const table of insertOrder) {
          for (const row of backup.data[table]) {
            const columns = Object.keys(row);
            if (columns.length === 0) continue;

            const placeholders = columns.map(() => "?").join(", ");
            const values = columns.map(column => row[column] ?? null);
            await db.runAsync(
              `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
              values,
            );
          }
        }
      });
    },
  };
}
