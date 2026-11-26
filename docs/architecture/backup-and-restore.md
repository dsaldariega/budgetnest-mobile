# Backup and Restore Architecture

## Phase 9 scope

BudgetNest Mobile now has a versioned portable JSON backup format and a database-level restore service.

The backup is intentionally **not** a raw SQLite database file. It contains application data as JSON so future schema migrations can validate and transform it without exposing the device database implementation as the public backup contract.

## Format

Every backup contains:

- `metadata.format` — identifies a BudgetNest backup.
- `metadata.formatVersion` — version of the portable JSON contract.
- `metadata.schemaVersion` — SQLite schema version represented by the backup.
- `metadata.exportedAt` — ISO timestamp.
- `data` — rows grouped by supported application table.

The current portable format is version `1` and represents SQLite schema version `4`.

## Validation

Before restore:

1. JSON must parse successfully.
2. The format identifier must match.
3. The format version must be supported.
4. The database schema version must match the current mobile schema.
5. Every supported table must exist as an array.
6. Primary-key values must be present, non-empty, and unique within each table.

A failed validation stops the restore before any existing local data is deleted.

## Restore behavior

Restore is transactional:

1. Validate the complete backup.
2. Delete existing application rows in foreign-key-safe order.
3. Insert backup rows in dependency order.
4. Commit only if every insert succeeds.

If an insert fails, SQLite rolls the restore back instead of leaving a partially restored database.

## Important safety boundary

Phase 9 does not add automatic cloud sync, Google Drive, encryption, recovery phrases, or file sharing. Those are separate concerns.

The next backup phase can add device file creation, import/export UI, and sharing. Encryption should be designed before backups are treated as a production security boundary.

## Current limitation

Backups are intentionally schema-version strict. A future schema change should add an explicit migration path for older backup formats rather than silently accepting incompatible data.
