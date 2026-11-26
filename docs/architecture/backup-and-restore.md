# Backup and Restore Architecture

## Phase 9 scope

BudgetNest Mobile now has a versioned portable JSON backup format and a database-level restore service.

The backup is intentionally not a raw SQLite database file. It contains application data as JSON so future schema migrations can validate and transform it without exposing the device database implementation as the public backup contract.

## Phase 10 scope

The portable backup can now be moved through the device:

- Export creates a dated JSON file in the app cache.
- The system share sheet can send the file to another app or storage provider.
- Restore opens the system document picker and reads a JSON backup from the selected file.
- Restore requires explicit confirmation because it replaces the current local database.

The mobile app still does not perform automatic cloud sync.

## Validation and restore safety

A selected file is parsed and validated before the destructive restore confirmation is shown.

Restore then:

1. Validates the backup again inside the repository.
2. Deletes existing application rows in foreign-key-safe order.
3. Inserts backup rows in dependency order.
4. Commits only if every insert succeeds.

If an insert fails, SQLite rolls the restore back instead of leaving a partially restored database.

## Security boundary

Phase 10 does not add encryption, recovery phrases, Google Drive sync, or automatic cloud backup.

Backups are plain JSON and should be treated as sensitive financial data. Encryption and recovery design should be completed before backups are presented as a security-protected production feature.

## Platform notes

expo-file-system is used for temporary local backup files, expo-document-picker for imports, and expo-sharing for exports.

The share sheet is intentionally used instead of building a custom cloud-storage integration. Users can choose a compatible destination such as a file provider or messaging/storage app supported by the device.

## Current limitation

Backups are intentionally schema-version strict. A future schema change should add an explicit migration path for older backup formats rather than silently accepting incompatible data.
