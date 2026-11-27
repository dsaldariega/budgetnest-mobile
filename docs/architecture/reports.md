# Search, Filters & Financial Reports

## Phase 16

Activity search supports text matching across title, details, account, and category, plus transaction kind, date range, account-name, and category-name filters. The existing unified history list remains the source for financial activity.

The Reports screen summarizes income, expenses, and net cash flow by currency for the current month, trailing three months, or current year. Expense totals are grouped by category, with transaction counts and proportional bars. A monthly trend is shown for the current year. All totals are grouped by currency; unlike currencies are never added together.

Reports are derived from non-deleted income and expense transactions. Transfers, loan repayments, subscription payments, and savings contributions are not counted as ordinary income or expenses, avoiding double counting with the transaction ledger. No schema migration or background processing is required.
