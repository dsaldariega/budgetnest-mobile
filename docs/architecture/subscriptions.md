# Mobile Subscription Architecture

## Scope

Phase 8 implements recurring subscription tracking on top of the existing local SQLite model.

The mobile behavior intentionally follows the audited BudgetNest web behavior:

- subscriptions support weekly, monthly, quarterly, and yearly billing;
- each subscription has a next billing date;
- recording a payment creates a separate subscription payment history row;
- recording a payment advances the next billing date by one cycle;
- subscription payments do not create ordinary expense transactions or change account balances;
- deleting the latest processed cycle can roll the next billing date back, but deleting an older payment does not rewind later processed cycles;
- a subscription with payment history is paused rather than deleted.

## Data boundaries

The subscriptions table stores the recurring obligation. The subscription_payments table stores each processed billing cycle.

The linked account and expense category are metadata for organization and future reporting. They are not used to mutate transaction balances when a subscription payment is recorded.

## Date rules

Billing dates use the shared date domain helpers. Monthly, quarterly, and yearly cycles clamp to the last valid day of the target month.

For example:

- January 31 monthly -> February 28 in a non-leap year
- February 29 yearly -> February 28 in the following non-leap year
- January 31 quarterly -> April 30

## Restore/backup note

Subscription and payment rows are part of the local database and will be included in the later versioned backup/restore design. This phase does not introduce import/export.
