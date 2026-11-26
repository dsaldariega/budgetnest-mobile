import { calculateBackupChecksum } from "./backup-integrity";

export const BACKUP_FORMAT_VERSION = 1;
export const DATABASE_SCHEMA_VERSION = 6;
export const BACKUP_TABLES = ["accounts","categories","recurring_rules","transactions","budgets","savings_goals","goal_contributions","subscriptions","subscription_payments","loans","loan_payments","activity_logs","app_settings"] as const;
export type BackupTableName = typeof BACKUP_TABLES[number];
export type BackupData = Record<BackupTableName, Record<string, unknown>[]>;
export type BackupRecordCounts = Record<BackupTableName, number>;
export type BudgetNestBackup = { metadata: { format: "budgetnest-backup"; formatVersion: number; schemaVersion: number; appVersion: string; exportedAt: string; recordCounts: BackupRecordCounts; checksum: string; }; data: BackupData; };

export function createBackupFilename(exportedAt = new Date().toISOString()): string { return "budgetnest-backup-" + exportedAt.slice(0, 10) + ".json"; }
function isPlainObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function hasUniqueKeys(rows: Record<string, unknown>[], key: string): boolean { const keys = new Set<string>(); for (const row of rows) { const value=row[key]; if (typeof value !== "string" || !value.trim() || keys.has(value)) return false; keys.add(value); } return true; }
function getRecordCounts(data: BackupData): BackupRecordCounts { return Object.fromEntries(BACKUP_TABLES.map(table => [table, data[table].length])) as BackupRecordCounts; }

export function createBackupPayload(data: BackupData, exportedAt = new Date().toISOString(), appVersion = "unknown"): BudgetNestBackup {
  return { metadata: { format:"budgetnest-backup", formatVersion:BACKUP_FORMAT_VERSION, schemaVersion:DATABASE_SCHEMA_VERSION, appVersion, exportedAt, recordCounts:getRecordCounts(data), checksum:calculateBackupChecksum(data) }, data };
}
export function serializeBackup(payload: BudgetNestBackup): string { validateBackupPayload(payload); return JSON.stringify(payload, null, 2); }
export function parseBackup(text: string): BudgetNestBackup { let parsed: unknown; try { parsed=JSON.parse(text); } catch { throw new Error("The selected backup is not valid JSON."); } validateBackupPayload(parsed); return parsed; }

export function validateBackupPayload(value: unknown): asserts value is BudgetNestBackup {
  if (!isPlainObject(value)) throw new Error("Backup must be a JSON object.");
  const metadata=value.metadata;
  if (!isPlainObject(metadata) || metadata.format!=="budgetnest-backup" || metadata.formatVersion!==BACKUP_FORMAT_VERSION || !Number.isInteger(metadata.schemaVersion) || metadata.schemaVersion < 5 || metadata.schemaVersion > DATABASE_SCHEMA_VERSION || typeof metadata.appVersion!=="string" || typeof metadata.exportedAt!=="string" || typeof metadata.checksum!=="string" || !/^[a-f0-9]{64}$/.test(metadata.checksum)) throw new Error("This backup format is unsupported or uses a different database schema.");
  if (Number.isNaN(Date.parse(metadata.exportedAt))) throw new Error("Backup export date is invalid.");
  if (!isPlainObject(metadata.recordCounts) || !isPlainObject(value.data)) throw new Error("Backup metadata or data is missing.");
  for (const table of BACKUP_TABLES) {
    const rows=value.data[table]; const count=metadata.recordCounts[table];
    if (!Array.isArray(rows) || !rows.every(isPlainObject) || typeof count!=="number" || !Number.isInteger(count) || count<0 || count!==rows.length) throw new Error("Backup table \""+table+"\" is invalid or has an incorrect record count.");
  }
  const data=value.data as BackupData;
  const primaryKeys: Record<BackupTableName,string>={accounts:"id",categories:"id",recurring_rules:"id",transactions:"id",budgets:"id",savings_goals:"id",goal_contributions:"id",subscriptions:"id",subscription_payments:"id",loans:"id",loan_payments:"id",activity_logs:"id",app_settings:"key"};
  for (const table of BACKUP_TABLES) if (!hasUniqueKeys(data[table],primaryKeys[table])) throw new Error("Backup table \""+table+"\" contains missing or duplicate primary keys.");
}
