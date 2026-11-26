# Activity and Financial History

## Phase 12

The Activity tab is now a unified financial history view backed by local SQLite.

It combines:
- income and expense transactions
- transfers
- loan payments
- subscription payments
- savings goal contributions

The history repository keeps this read model separate from the write repositories. It supports type filtering, text search, date ranges, and a bounded result limit.

## UI

Activity entries can be opened for details. Loan payments expose the interest/principal allocation, while other entries expose their account, category, date, and notes when available.

The tab and modal surfaces use safe-area-aware containers. The bottom tab bar also accounts for the device bottom inset so content and navigation controls do not overlap system navigation areas.

No cloud sync, automatic backup, or new database migration was added in this phase.


## Phase 13

Loans now have a complete repayment lifecycle foundation.

- Payment dates are validated against the loan start date and previous payment.
- Flat-rate payments can settle remaining future fixed-term interest after principal is fully covered.
- Deleting a payment recalculates all remaining payment allocations in one SQLite transaction.
- A deleted payment restores a paid loan to active when an obligation remains.
- Payment deletion is recorded in the local activity log.
- No database migration was required.
