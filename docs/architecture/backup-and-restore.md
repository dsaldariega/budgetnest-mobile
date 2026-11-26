# Backup and Restore Architecture

## Phase 9 scope

BudgetNest Mobile has a versioned portable JSON backup format and a database-level restore service.

The backup is intentionally not a raw SQLite database file. It contains application data as JSON so future schema migrations can validate and transform it without exposing the device database implementation as the public backup contract.

## Phase 10 scope

The portable backup can be moved through the device:

- Export creates a dated JSON file in the app cache.
- The system share sheet can send the file to another app or storage provider.
- Restore opens the system document picker and reads a JSON backup from the selected file.
- Restore requires explicit confirmation because it replaces the current local database.

The mobile app still does not perform automatic cloud sync.

## Phase 11 scope

Backup and restore now have a stronger data-safety boundary:

- Every backup records the app version, database schema version, export timestamp, per-table record counts, and a SHA-256 checksum.
- The checksum is calculated from canonicalized backup data so JSON formatting or object-key ordering does not change the integrity value.
- Restore verifies the checksum before deleting any current data.
- Restore runs SQLite foreign-key and integrity checks inside the same transaction after insertion. A failed integrity check rolls the restore back.
- The restore confirmation shows the backup version, timestamp, and total records before the destructive action.

The checksum detects accidental corruption and ordinary file modification. It is not a cryptographic signature and does not prove who created a backup; encryption/authentication is a later security phase.

## Validation and restore safety

A selected file is structurally validated before the destructive restore confirmation is shown.

Restore then:

1. Parses and validates the backup format and record counts.
2. Verifies the SHA-256 checksum against the backup data.
3. Starts a database transaction.
4. Deletes existing application rows in foreign-key-safe order.
5. Inserts backup rows in dependency order.
6. Runs SQLite foreign-key and integrity checks.
7. Commits only if every insert and integrity check succeeds.

If any restore step fails, SQLite rolls the restore back instead of leaving a partially restored database.

## Security boundary

Phase 11 still does not add encryption, recovery phrases, Google Drive sync, or automatic cloud backup.

Backups are plain JSON and should be treated as sensitive financial data. The checksum improves corruption detection but does not protect the contents from someone who can read or replace the file. Encryption and recovery design should be completed before backups are presented as a security-protected production feature.

## Platform notes

expo-file-system is used for temporary local backup files, expo-document-picker for imports, and expo-sharing for exports.

The share sheet is intentionally used instead of building a custom cloud-storage integration. Users can choose a compatible destination such as a file provider or messaging/storage app supported by the device.

## Current limitation

Backups are intentionally schema-version strict. A future schema change should add an explicit migration path for older backup formats rather than silently accepting incompatible data.
