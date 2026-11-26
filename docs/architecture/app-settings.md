# App Settings and Data Management

## Preferences

- The default currency preference is stored in the existing `app_settings` table.
- It is used only to prefill the currency field when creating a new account.
- Changing it never changes existing account currencies, converts balances, or combines unlike currencies.
- Supported defaults: PHP, USD, EUR, GBP, AUD, CAD, SGD, and JPY.
- If a backup does not contain a valid preference, the app falls back to PHP.

## Local data overview

Settings displays the local database schema version and a count of records across the main financial tables. This is informational; it does not expose a destructive database reset action.

## Backup and restore

The existing versioned JSON backup, share-sheet export, document-picker import, checksum verification, and transactional restore remain the supported data portability workflow. Backups contain sensitive financial data and should be stored privately.

## Cloud and privacy boundary

The app remains local-first. This phase does not add sign-in, cloud sync, automatic backup, or account-level telemetry.
