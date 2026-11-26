# Budgets and Savings Goals

Phase 6 adds local-first budget and savings-goal workflows.

## Budgets
Budgets are tied to one active account and one expense category. Spending is calculated from non-deleted expense transactions for that account/category inside the domain-defined budget window.
Supported periods are weekly, monthly, yearly, and custom. Weekly periods repeat every 7 days from the original start date. Monthly and yearly periods stay anchored to the original start day with end-of-month clamping. Custom periods use an explicit end date.
Budget spending never counts income or transfers.

## Savings goals
Savings goals are tied to an account for organizational context. Contributions are stored separately in goal_contributions and increase goal progress without creating a normal account transaction. Legacy direct goal balances are preserved through legacy_current_amount_minor; new contributions are added on top for compatibility.

## Scope
Phase 6 intentionally keeps budgets and goals local. Backup/restore and cloud integrations remain later phases.
