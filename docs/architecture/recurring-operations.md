# Recurring Financial Operations

## Phase 15

Recurring schedules are separate from subscriptions. They represent repeatable income and expense transactions such as salary, rent, allowances, and regular household costs.

A schedule stores its name, type, amount, account, category, weekly/monthly/yearly frequency, interval, first occurrence, optional end date, next occurrence, and active/paused state.

## Generation

Generation is an explicit user action. The app does not create recurring transactions silently on launch or in the background. When the user chooses to generate due entries, the repository creates all due occurrences through the selected date, including missed occurrences.

Generated transactions are normal income/expense ledger entries, so they affect account balances, monthly cash flow, and budgets as expected. Each generated row retains its recurring schedule and occurrence date. A unique partial index plus deterministic transaction IDs prevent duplicate occurrences.

The generation process is transactional. If a schedule references an archived account or invalid category, the operation fails without partially generating entries. Schedules with an end date stop after the last occurrence on or before that date.

Schedules can be edited, paused, resumed, or deleted. Editing a schedule with generated history preserves its next due date. Deleting a schedule preserves already-generated transactions; the optional schedule reference becomes null.

The recurring_rules table is included in versioned backup and restore. Database schema version is 11. Existing transactions remain compatible; recurrence linkage columns are nullable.

Subscriptions remain separate with their own billing and payment history. No cloud sync or background scheduling was introduced.
