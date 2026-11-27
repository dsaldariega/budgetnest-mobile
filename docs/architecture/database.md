# Local Database Architecture

## Decision

BudgetNest Mobile uses Expo SQLite as its local source of truth. Core features work without an account or network connection.

## Money and currency

Monetary values use integer minor units (PHP centavos). PHP 125.50 is stored as 12550. Never use SQLite REAL/FLOAT for money. Currency is stored per account; do not combine currencies without conversion.

## Schema versions

Migration 1 creates accounts, categories, transactions, budgets, savings goals, goal contributions, subscriptions, and app settings.

Migration 2 adds source metadata for account/category import compatibility, preserves legacy savings-goal balances, rebuilds transactions to enforce paired transfer direction, and adds loans, loan payments, subscription payment history, and activity logs. Migration 1 remains immutable.

## Domain boundary

Financial rules live in src/domain and do not depend on React Native or SQLite. The modules cover integer money, date arithmetic, account balances and transfer validation, budget windows, loan interest allocation, and subscription date advancement.

## Financial invariants

- Transfers are paired rows with equal amounts and one shared group ID. Source is out; destination is in.
- Cross-currency transfers are unsupported.
- Balance = opening balance + income + incoming transfers - expenses - outgoing transfers.
- Deleted transactions do not affect balances.
- Budget periods remain anchored to their original start date.
- Subscription month/year advancement clamps to the last valid day in the target month.
- Loan payments allocate accrued interest before principal. Payment ordering and reallocation belong in the loan feature/repository layer.

## Verification

Run npm test for pure domain tests and npm run typecheck after dependencies are installed. Runtime SQLite migration tests, Expo Doctor, and Android/iOS builds still require a local install.