import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";
import {
  BACKUP_TABLES,
  createBackupPayload,
  parseBackup,
  serializeBackup,
  type BackupData,
  type BudgetNestBackup,
} from "./backup-format";
import { verifyBackupChecksum } from "./backup-integrity";
import { SYSTEM_CATEGORIES } from "@/database/system-category-seed";

const restoreOrder = [
  "activity_logs",
  "loan_payments",
  "subscription_payments",
  "goal_contributions",
  "transactions",
  "recurring_rules",
  "loans",
  "subscriptions",
  "budgets",
  "savings_goals",
  "categories",
  "accounts",
  "app_settings",
] as const;

const insertOrder = [
  "accounts",
  "categories",
  "recurring_rules",
  "transactions",
  "budgets",
  "savings_goals",
  "goal_contributions",
  "subscriptions",
  "subscription_payments",
  "loans",
  "loan_payments",
  "activity_logs",
  "app_settings",
] as const;

async function assertDatabaseIntegrity(db: SQLiteDatabase): Promise<void> {
  const foreignKeyErrors = await db.getAllAsync<Record<string, unknown>>("PRAGMA foreign_key_check");
  if (foreignKeyErrors.length > 0) {
    throw new Error("Restored data failed the database relationship check.");
  }

  const integrityRows = await db.getAllAsync<{ integrity_check: string }>("PRAGMA integrity_check");
  if (integrityRows[0]?.integrity_check !== "ok") {
    throw new Error("Restored data failed the SQLite integrity check.");
  }
}

function quoteIdentifier(identifier: string): string {
  return '"' + identifier.replace(/"/g, '""') + '"';
}

export function createBackupRepository(db: SQLiteDatabase, appVersion = "unknown") {
  return {
    async createBackup(): Promise<BudgetNestBackup> {
      const data = {} as BackupData;

      // Keep every table read in one SQLite snapshot so the export cannot mix
      // records from before and after another write.
      await db.withTransactionAsync(async () => {
        for (const table of BACKUP_TABLES) {
          data[table] = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM " + table);
        }
      });

      return createBackupPayload(
        data,
        new Date().toISOString(),
        appVersion,
      );
    },

    async exportJson(): Promise<string> {
      return serializeBackup(await this.createBackup());
    },

    async restoreJson(text: string): Promise<void> {
      const backup = parseBackup(text);
      verifyBackupChecksum(backup.data, backup.metadata.checksum);

      await db.withTransactionAsync(async () => {
        await db.runAsync(
          "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)",
          "backup_restore_in_progress",
          "1",
          new Date().toISOString(),
        );

        for (const table of restoreOrder) {
          if (table === "app_settings") continue;
          await db.runAsync("DELETE FROM " + table);
        }

        await db.runAsync("DELETE FROM app_settings WHERE key <> ?", "backup_restore_in_progress");

        for (const table of insertOrder) {
          for (const row of backup.data[table]) {
            const columns = Object.keys(row);
            if (columns.length === 0) continue;

            const quotedColumns = columns.map(quoteIdentifier).join(", ");
            const placeholders = columns.map(() => "?").join(", ");
            const values = columns.map(column => row[column] ?? null) as SQLiteBindValue[];

            await db.runAsync(
              "INSERT INTO " + table + " (" + quotedColumns + ") VALUES (" + placeholders + ")",
              values,
            );
          }
        }

        for (const category of SYSTEM_CATEGORIES) {
          await db.runAsync(
            "INSERT OR IGNORE INTO categories (id, name, type, icon, is_system, source_name, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)",
            category.id,
            category.name,
            category.type,
            category.icon,
            category.sourceName ?? null,
            "2026-11-26T00:00:00.000Z",
            "2026-11-26T00:00:00.000Z",
          );
        }

        await db.runAsync("DELETE FROM app_settings WHERE key = ?", "backup_restore_in_progress");
        await assertDatabaseIntegrity(db);
      });
    },
  };
}
