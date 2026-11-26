export const BACKUP_FORMAT_VERSION = 1;
export const DATABASE_SCHEMA_VERSION = 4;

export const BACKUP_TABLES = [
  "accounts", "categories", "transactions", "budgets", "savings_goals",
  "goal_contributions", "subscriptions", "subscription_payments", "loans",
  "loan_payments", "activity_logs", "app_settings",
] as const;

export type BackupTableName = typeof BACKUP_TABLES[number];
export type BackupData = Record<BackupTableName, Record<string, unknown>[]>;

export type BudgetNestBackup = {
  metadata: {
    format: "budgetnest-backup";
    formatVersion: number;
    schemaVersion: number;
    exportedAt: string;
  };
  data: BackupData;
};

export function createBackupFilename(exportedAt = new Date().toISOString()): string {
  const date = exportedAt.slice(0, 10);
  return `budgetnest-backup-${date}.json`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUniqueKeys(rows: Record<string, unknown>[], key: string): boolean {
  const keys = new Set<string>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value !== "string" || !value.trim() || keys.has(value)) return false;
    keys.add(value);
  }
  return true;
}

export function createBackupPayload(
  data: BackupData,
  exportedAt = new Date().toISOString(),
): BudgetNestBackup {
  return {
    metadata: {
      format: "budgetnest-backup",
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: DATABASE_SCHEMA_VERSION,
      exportedAt,
    },
    data,
  };
}

export function serializeBackup(payload: BudgetNestBackup): string {
  validateBackupPayload(payload);
  return JSON.stringify(payload, null, 2);
}

export function parseBackup(text: string): BudgetNestBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The selected backup is not valid JSON.");
  }
  validateBackupPayload(parsed);
  return parsed;
}

export function validateBackupPayload(value: unknown): asserts value is BudgetNestBackup {
  if (!isPlainObject(value)) throw new Error("Backup must be a JSON object.");

  const metadata = value.metadata;
  if (
    !isPlainObject(metadata) ||
    metadata.format !== "budgetnest-backup" ||
    metadata.formatVersion !== BACKUP_FORMAT_VERSION ||
    metadata.schemaVersion !== DATABASE_SCHEMA_VERSION ||
    typeof metadata.exportedAt !== "string"
  ) {
    throw new Error("This backup format is unsupported or uses a different database schema.");
  }

  if (!isPlainObject(value.data)) throw new Error("Backup data is missing.");

  for (const table of BACKUP_TABLES) {
    const rows = value.data[table];
    if (!Array.isArray(rows) || !rows.every(isPlainObject)) {
      throw new Error(`Backup table "${table}" is invalid.`);
    }
  }

  const data = value.data as BackupData;
  const primaryKeys: Record<BackupTableName, string> = {
    accounts: "id", categories: "id", transactions: "id", budgets: "id",
    savings_goals: "id", goal_contributions: "id", subscriptions: "id",
    subscription_payments: "id", loans: "id", loan_payments: "id",
    activity_logs: "id", app_settings: "key",
  };

  for (const table of BACKUP_TABLES) {
    if (!hasUniqueKeys(data[table], primaryKeys[table])) {
      throw new Error(`Backup table "${table}" contains missing or duplicate primary keys.`);
    }
  }
}
