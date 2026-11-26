import Constants from "expo-constants";
import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";
import { BACKUP_TABLES, createBackupPayload, parseBackup, serializeBackup, type BackupData, type BudgetNestBackup } from "./backup-format";
import { verifyBackupChecksum } from "./backup-integrity";
const restoreOrder=["activity_logs","loan_payments","subscription_payments","goal_contributions","transactions","loans","subscriptions","budgets","savings_goals","categories","accounts","app_settings"] as const;
const insertOrder=["accounts","categories","transactions","budgets","savings_goals","goal_contributions","subscriptions","subscription_payments","loans","loan_payments","activity_logs","app_settings"] as const;
async function assertDatabaseIntegrity(db: SQLiteDatabase): Promise<void> {
  const foreignKeyErrors=await db.getAllAsync<Record<string,unknown>>("PRAGMA foreign_key_check");
  if (foreignKeyErrors.length>0) throw new Error("Restored data failed the database relationship check.");
  const integrityRows=await db.getAllAsync<{integrity_check:string}>("PRAGMA integrity_check");
  if (integrityRows[0]?.integrity_check!=="ok") throw new Error("Restored data failed the SQLite integrity check.");
}
export function createBackupRepository(db: SQLiteDatabase) { return {
  async createBackup(): Promise<BudgetNestBackup> {
    const data={} as BackupData;
    for (const table of BACKUP_TABLES) data[table]=await db.getAllAsync<Record<string,unknown>>("SELECT * FROM "+table);
    return createBackupPayload(data,new Date().toISOString(),Constants.expoConfig?.version ?? "unknown");
  },
  async exportJson(): Promise<string> { return serializeBackup(await this.createBackup()); },
  async restoreJson(text:string): Promise<void> {
    const backup=parseBackup(text); verifyBackupChecksum(backup.data,backup.metadata.checksum);
    await db.withTransactionAsync(async()=>{
      for (const table of restoreOrder) await db.runAsync("DELETE FROM "+table);
      for (const table of insertOrder) for (const row of backup.data[table]) {
        const columns=Object.keys(row); if (columns.length===0) continue;
        const placeholders=columns.map(()=>"?").join(", ");
        const values=columns.map(column=>row[column] ?? null) as SQLiteBindValue[];
        await db.runAsync("INSERT INTO "+table+" ("+columns.join(", ")+") VALUES ("+placeholders+")",values);
      }
      await assertDatabaseIntegrity(db);
    });
  },
}; }
