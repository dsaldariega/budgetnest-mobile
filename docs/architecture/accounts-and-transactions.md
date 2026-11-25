# Accounts and Transactions

## Accounts
- Accounts are stored locally in SQLite and archived rather than deleted, preserving transaction history.
- Supported types: cash, bank, e-wallet, credit card, investment, and other.
- Investment is stored as internal `other` plus source metadata; credit card preserves its mapping to the web `credit` type.
- Currency is stored per account. Balances are not combined across currencies.
- Current balance is derived from opening balance and non-deleted transaction rows.

## Transactions
- Income and expense require an active account and a category of the matching type.
- Amounts use positive integer minor units.
- Transactions use soft deletion.
- Transfers are two equal rows sharing a transfer group ID, one `out` and one `in`.
- Transfer creation uses a SQLite transaction so both rows succeed or neither does.
- Transfers require different active accounts with matching currencies.
- Deleting either side of a transfer soft-deletes both rows.

## Categories
Migration 3 seeds default income and expense categories. Category customization is planned separately.

## Scope
This phase includes account creation/listing/archiving, balance calculation, income/expense recording, paired transfers, transaction history, filtering, and soft deletion. Editing, custom categories, reporting, budgets, goals, loans, subscriptions, and backup/restore remain separate phases.
