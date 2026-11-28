# Mobile Financial Accounting Policy

## Purpose

BudgetNest Mobile keeps loan and subscription records separate from ordinary account transactions.

## Loan accounting

- Creating a loan creates a loan record only. The principal does not automatically change the linked account balance.
- Recording a loan payment creates a loan-payment history row only. It does not automatically create an ordinary expense transaction or change the linked account balance.
- Loan payment allocation still tracks principal and interest inside the loan record.
- If the user wants the cash movement to appear in account balances, they may record the corresponding ordinary income or expense transaction separately.

## Subscription accounting

- Creating a subscription creates the recurring obligation only.
- Recording a subscription payment creates a subscription-payment history row and advances the next billing date.
- Subscription payments do not automatically create ordinary expense transactions or change account balances.
- Deleting the latest processed cycle may roll the next billing date back when it is still the immediate next cycle; deleting an older cycle does not rewind later processed cycles.

## Activity and history

Loan and subscription payment events are represented by their dedicated Activity events. They must not also appear as ordinary transaction entries, which would duplicate the same financial event.

Linked transaction IDs are therefore not generated for new loan or subscription records.
