# Dashboard and Financial Overview

## Phase 14

The Home tab is a local SQLite-backed financial overview.

It presents:
- active account balances grouped by currency (currencies are never added together)
- current-month income, expenses, and net cash flow grouped by currency
- quick access to Activity, Accounts, Budgets, and Savings
- active budget progress and savings goal progress
- upcoming or overdue subscription bills
- active and paused loan obligations
- the five most recent financial history entries

The dashboard uses the existing repositories and domain calculations. It is a read-only overview; financial records continue to be created and maintained in their dedicated screens.

## Icons and navigation

The tab bar and dashboard sections use Material Community Icons through Expo's vector icon package. Icon color follows the active light/dark theme, with the existing BudgetNest red accent for active navigation and primary actions.

## Data and currency safety

Balances are calculated by the account repository. Monthly income and expense totals exclude soft-deleted transactions and are grouped by account currency. The dashboard never combines different currencies into one amount.

No new database tables, migrations, cloud services, or background jobs were added.
