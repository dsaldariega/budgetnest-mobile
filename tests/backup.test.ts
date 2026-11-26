import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_FORMAT_VERSION,
  DATABASE_SCHEMA_VERSION,
  createBackupFilename,
  createBackupPayload,
  parseBackup,
  serializeBackup,
  type BackupData,
} from "@/services/backup/backup-format";

function emptyData(): BackupData {
  return {
    accounts: [], categories: [], transactions: [], budgets: [], savings_goals: [],
    goal_contributions: [], subscriptions: [], subscription_payments: [], loans: [],
    loan_payments: [], activity_logs: [], app_settings: [],
  };
}

test("backup filename uses a stable dated JSON name", () => {
  assert.equal(
    createBackupFilename("2026-11-26T01:23:39.000Z"),
    "budgetnest-backup-2026-11-26.json",
  );
});

test("backup payload contains explicit format and schema versions", () => {
  const backup = createBackupPayload(emptyData(), "2026-11-26T00:00:00.000Z");
  assert.equal(backup.metadata.format, "budgetnest-backup");
  assert.equal(backup.metadata.formatVersion, BACKUP_FORMAT_VERSION);
  assert.equal(backup.metadata.schemaVersion, DATABASE_SCHEMA_VERSION);
  assert.equal(backup.metadata.exportedAt, "2026-11-26T00:00:00.000Z");
});

test("backup serializes and parses without losing rows", () => {
  const data = emptyData();
  data.accounts.push({
    id: "account-1", name: "Main Cash", currency_code: "PHP", opening_balance_minor: 100000,
  });
  const restored = parseBackup(serializeBackup(createBackupPayload(data)));
  assert.deepEqual(restored.data.accounts, data.accounts);
});

test("backup rejects malformed JSON", () => {
  assert.throws(() => parseBackup("{not-json"), /valid JSON/);
});

test("backup rejects duplicate primary keys", () => {
  const data = emptyData();
  data.accounts.push({ id: "account-1", name: "Cash" });
  data.accounts.push({ id: "account-1", name: "Bank" });
  const payload = createBackupPayload(data);
  assert.throws(() => parseBackup(serializeBackup(payload)), /duplicate primary keys/);
});

test("backup rejects a different schema version", () => {
  const payload = createBackupPayload(emptyData());
  payload.metadata.schemaVersion = DATABASE_SCHEMA_VERSION + 1;
  assert.throws(() => parseBackup(JSON.stringify(payload)), /different database schema/);
});
