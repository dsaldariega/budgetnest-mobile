# Local Database Architecture

## Decision

BudgetNest Mobile uses **Expo SQLite as its local source of truth**. Core screens will read and write local data without requiring an account, network connection, Supabase project, or Google sign-in.

The database file is named `budgetnest.db` and is opened once through the root `SQLiteProvider`. The provider runs migrations before rendering the app routes.

## Money representation

All monetary values are stored as integer minor units (for PHP, centavos). For example, PHP 125.50 is stored as `12550`. Do not store money in SQLite REAL/FLOAT columns; floating-point rounding can corrupt financial calculations.

Currency is stored with each account using an ISO 4217-style three-letter code. The current default is PHP, but the schema does not assume every future account uses PHP.

## Initial schema (migration 1)

| Table | Purpose |
| --- | --- |
| `accounts` | Cash, bank, e-wallet, credit-card, and other accounts |
| `categories` | Income and expense categories |
| `transactions` | Income/expense entries; transfer pairs share a transfer group ID |
| `budgets` | Category budgets for a defined period |
| `savings_goals` | Savings targets |
| `goal_contributions` | Individual contributions to savings goals |
| `subscriptions` | Recurring subscription obligations |
| `app_settings` | Small local application settings |

Loans and detailed recurring-transaction rules are intentionally not included in this first schema. Their data shape and financial behavior should be confirmed against the existing BudgetNest web implementation before we freeze those models.

## Migration rules

- SQLite `PRAGMA user_version` is the schema version.
- Migrations are ordered and run inside a transaction.
- A successful migration updates `user_version` only after its SQL completes.
- **Never edit a migration already released to users.** Add the next numbered migration instead.
- Enable foreign-key enforcement on every database connection.
- Use parameterized statements for user-provided values. Do not interpolate user input into SQL.

## Repository boundary

Feature code should use repository functions rather than writing SQL in screens or components. Repositories map SQLite snake_case rows to TypeScript camelCase domain objects.

The first account and transaction repositories establish the pattern. Business calculations and validation stay outside SQLite repositories so they can be unit-tested and potentially shared with the web app later.

## Transfer handling

A transfer is represented as two linked transaction entries: an expense from the source account and an income to the destination account. Both entries share a `transfer_group_id` and must be created/deleted atomically by a dedicated transfer use case in a later feature phase. This avoids treating a transfer as income or spending in overall reports.

## Backup and security

Backups will be portable, versioned JSON snapshots rather than copies of the raw SQLite database. The backup format will be designed in a later phase after the domain schema is audited.

This phase does not enable SQLCipher. SQLCipher requires a custom native build and careful key management; simply setting a pragma in Expo Go does not encrypt the database. We will decide on at-rest encryption and recovery behavior before implementing backup/export or production distribution.

## Current limitations

- The first migration is a foundation, not the complete final financial model.
- Loan, recurring schedule, split transaction, attachment, and sync metadata models remain subject to the web-app audit.
- Repository methods are foundational examples; feature-level validation and atomic multi-record use cases are added with their respective features.
- Runtime migration, Android/iOS behavior, and TypeScript checks still require an actual project install/build.
