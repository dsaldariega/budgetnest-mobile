# Existing BudgetNest Web App Audit

## Audit scope and source snapshot

- Repository: `dsaldariega/personalized-budget-tracker`
- Branch reviewed: `dev`
- Branch commit reviewed: `4323fa484743bcbc70d3dd6946b500bff8b8a11d`
- Review method: static source review of the Express routes, Supabase migrations, guest-mode API store, and key frontend calculation components.
- This is not a live-data audit. No production database contents, deployed environment variables, user records, or runtime behavior were accessed or changed.
- The audit is a design and compatibility review, not a claim that all existing application behavior has passed tests.

## 1. Existing architecture

The web application is a Next.js/React frontend with an Express API and Supabase PostgreSQL/Auth.

There are two data paths:

1. **Authenticated path:** frontend API client obtains the Supabase session token and calls the Express API. The API scopes reads and writes to the authenticated user and uses Supabase.
2. **Guest path:** when there is no usable session, the frontend API client delegates to `frontend/src/lib/guest-store.ts`. That store holds arrays in module memory. It is not persistent storage: reloading or closing the app can discard guest records.

The mobile app should not reproduce the in-memory guest store. SQLite will be the local source of truth for mobile, with no mandatory login.

## 2. Existing data model

| Web entity/table | Existing role | Mobile compatibility note |
| --- | --- | --- |
| `profiles` | User profile and default currency | No profile/login is required for the initial local-first mobile experience |
| `accounts` | Owner, name, account type, currency, opening balance, archived flag | Keep currency per account; map account type values explicitly |
| `transactions` | Income, expense, and paired transfer rows | Mobile schema must support transfer rows and direction |
| `budgets` | Account/category spending limit and period window | Preserve account and category matching plus anchored period behavior |
| `savings_goals` | Target and directly stored current amount | Existing web app has no contribution-history table |
| `loans` | Principal, monthly interest rate, interest type, term, dates, status | Preserve flat-rate and reducing-balance variants |
| `loan_payments` | Payment total split into principal and interest | Must be represented separately from ordinary account transactions |
| `subscriptions` | Account-linked recurring obligation and next billing date | Preserve billing frequency and next-date behavior |
| `subscription_payments` | Billing-cycle payment history | Separate from ordinary transactions and account balance |
| `activity_logs` | Owner-scoped activity history | Consider a local audit/activity table in a later feature phase |

The web schema uses PostgreSQL `numeric(14,2)` for monetary amounts. API validation rejects values with more than two decimal places. Mobile should use integer minor units (centavos for PHP) and convert at the UI/API boundaries.

The existing web app uses free-text transaction and budget categories. The mobile Phase 2 schema introduces a normalized `categories` table and category foreign key. This is a reasonable mobile direction, but migration/import mapping must preserve existing category names and avoid silently changing matching behavior.

## 3. Financial behavior found in the web app

### Accounts and balances

- Current account balance is derived, not stored: opening balance + income + incoming transfers - expenses - outgoing transfers.
- Archived accounts are excluded from active-account balance summaries and cannot be selected for new linked records. Existing linked records can still be viewed and the same archived account can remain selected when editing a dependent record.
- Account currency is stored on the account. The dashboard groups balances, income, and expenses by currency rather than treating different currencies as directly additive.
- The API prevents deleting an account while foreign-key-linked financial records remain; it recommends archiving instead.

### Transactions and transfers

- A normal transaction is either income or expense, has a positive amount, category, optional description, date, and account.
- A transfer is two transaction rows sharing a `transfer_group_id`: one `out` from the source and one `in` to the destination.
- Transfers require two distinct active accounts owned by the same user and the same currency. Cross-currency transfers are not supported.
- Transfers are excluded from income/expense reporting so moving money between accounts does not inflate income or spending.
- Deleting either transfer row deletes the entire transfer group. The API does not permit editing transfer rows through the normal transaction update endpoint.
- Balance calculations treat a transfer out as a deduction and transfer in as an addition.

### Budgets

- A budget belongs to one account and matches expenses by account and category.
- Weekly periods repeat in seven-day blocks anchored to the budget start date.
- Monthly and yearly periods are anchored to the original start date (including its day of month), not necessarily calendar-month or calendar-year boundaries.
- Custom budgets use their explicit start and end dates; an end date is required for a custom period.
- The dashboard compares categories case-insensitively, while the Budgets page currently compares category strings exactly. This can cause a difference in displayed spend if category casing differs.
- Budget usage is computed from expense transactions in the current active budget window; transfers and income are not included.

### Savings goals

- Each goal is linked to one account and stores `target_amount`, `current_amount`, target date, and status.
- The current saved amount is directly editable/stored on the goal record.
- The existing web schema has no goal-contribution/payment history table. The mobile Phase 2 `goal_contributions` table is a new capability, not a direct mirror of the web model. We should decide whether to introduce contribution history while keeping a compatible current balance.

### Loans

- A loan is linked to an account and stores principal, a monthly interest percentage, interest type, term, start/due dates, notes, and status.
- Supported interest types are `flat_rate` and `reducing_balance`. The monthly rate is a percentage (e.g. 2 means 2% per month).
- Due date is calculated from start date plus term months, clamping to the last valid day of the target month.
- The displayed monthly estimate for flat rate is (principal + principal × monthly rate × term) / term.
- The displayed reducing-balance estimate uses the standard fixed-payment amortization formula; at zero rate it is principal / term.
- Actual payment allocation is date-driven: payments are ordered by payment date and creation time. Interest accrues between payment dates using fractional months. Reducing-balance interest accrues on remaining principal; flat interest accrues on original principal up to the total term interest.
- A payment is allocated to accrued interest first, then principal. For flat-rate loans, an amount may also settle future fixed-term interest after principal is covered. Payments cannot exceed the remaining obligation.
- Payment dates cannot precede the loan start date or be earlier than the previous payment date.
- Loan calculation terms cannot be changed after any repayment has been recorded. Payment deletion recalculates later automatic allocations.
- Loan status can also be manually set to active, paid, or paused.
- Loan records and loan-payment history are tracked separately from account transactions. Recording a loan payment does not itself change the linked account's calculated balance.
- The loan route performs several related writes separately (payment insert, status update, and activity log; deletion and later reallocation updates). These are not one database transaction, so partial completion is possible if a later write fails.

### Subscriptions

- A subscription belongs to one account and stores amount, weekly/monthly/quarterly/yearly frequency, next billing date, category, notes, and active status.
- Recording a payment creates a subscription-payment history row for the current next billing date and advances the next billing date by one billing period.
- Subscription payments are intentionally separate from normal transactions: they do not automatically create an expense transaction or change account balance.
- Deleting a payment history row rolls the next billing date back only if the subscription's current next date is exactly the immediate next cycle after that payment. Otherwise the date is left unchanged to avoid undoing a later processed cycle.
- The payment insert and next-date update are separate writes, so a failure can leave a payment recorded while the next date remains unchanged.

## 4. Guest-mode differences and risks

The in-memory guest implementation does not enforce parity with the authenticated API:

- It is volatile and can lose all records when the page reloads or the module is recreated.
- Guest transaction creation does not consistently validate account ownership/activity or all API constraints.
- Guest transfers do not enforce same-currency accounts.
- Guest loan payments currently allocate the entire amount to principal and zero to interest; they do not use the authenticated flat/reducing-balance calculation, enforce date ordering, or enforce the remaining-obligation limit.
- Guest loan due-date calculation uses JavaScript month mutation without the backend's end-of-month clamping, so dates near month-end can diverge.
- Guest subscription payment date advancement also uses direct month mutation and can overflow for dates such as the 31st; the authenticated backend clamps to the last day of the target month.
- Guest subscription-payment deletion removes the history row but does not apply the backend's conditional next-billing-date rollback.
- Guest account deletion removes some linked arrays instead of enforcing the backend's restrictive foreign-key behavior, and does not consistently clean up all dependent loan/payment records.
- Guest mode does not provide the same complete validation and referential-integrity guarantees as the authenticated path.

**Mobile decision:** SQLite must have one set of domain rules and validation regardless of whether the device is online. There should not be separate "guest" and "signed-in" financial calculation implementations.

## 5. Backup and import/export

- The authenticated API exports a JSON snapshot with format name, version 1, export timestamp, user ID, and rows from profiles, accounts, transactions, budgets, savings goals, loans, loan payments, subscriptions, subscription payments, and activity logs.
- Export pages through records in batches of 1,000.
- The reviewed settings route provides CSV transaction import, not a full JSON backup restore endpoint.
- CSV import matches accounts by case-insensitive name plus currency, checks a fingerprint to skip duplicates, and inserts new rows in batches of 100.
- CSV import can partially complete if a later batch fails; the route reports how many new rows were inserted before failure. It is not one all-or-nothing transaction.
- The current JSON export is not a complete portable restore contract: it includes the source user ID and has no reviewed restore/identity-remapping flow, encryption, checksum, or explicit compatibility migration mechanism.

**Mobile decision:** implement a separate, versioned portable backup format with stable local IDs, schema version, validation, integrity checks, and an explicit restore strategy. Do not copy the current server export format blindly. Encryption and recovery-key UX need a separate design before release.

## 6. Supabase security and migration observations

- The initial schema scopes financial rows by `user_id`, uses composite foreign keys for account ownership, enables RLS, and defines owner-scoped policies.
- Later migrations add transfer direction constraints, loan and subscription payment ownership constraints, supporting indexes, username support, and restrictions on anonymous/public access.
- The profile bootstrap trigger function is explicitly revoked from public/anon/authenticated RPC execution.
- The two migrations `20261112032835_add_loan_interest_types_and_derived_due_date.sql` and `20261112033022_add_loan_interest_types_and_derived_due_date.sql` contain the same idempotent SQL. This appears redundant and should be reviewed before future migration maintenance.
- The repository includes only a small validation test file in the inspected tree. The reviewed CI workflow has no executed test/build steps configured. Static source review does not establish production database correctness or runtime behavior.

## 7. Phase 2 mobile schema compatibility gaps

The initial mobile SQLite migration is a foundation, not yet compatible with all current web records. Before building transaction and account features, address these gaps with a new additive migration (do not rewrite a migration already released):

1. **Transfers:** mobile `transactions.type` currently allows only `income` and `expense`, even though the web app requires `transfer`. Add transfer type and a checked `transfer_direction` field; enforce that transfer rows have both a group ID and direction, while non-transfer rows have neither.
2. **Account types:** web values include `cash`, `bank`, `e_wallet`, `credit`, `investment`, and `other`; mobile currently uses `credit_card` and omits `investment`. Define an explicit mapping and avoid silently dropping either value.
3. **Loan records:** add the audited loan fields and a separate loan-payment table before implementing loan UI/calculations.
4. **Subscription records:** add payment history and preserve billing frequency/next-date semantics before implementing subscription UI.
5. **Goal compatibility:** retain a way to represent the existing `current_amount` while deciding how new contribution history affects it.
6. **Activity history:** decide the local event model and retention/export behavior before building the activity screen.
7. **Categories:** define import/mapping behavior from the web app's free-text categories into the mobile category table.

The existing mobile database already uses integer minor units, account currency, foreign keys, migration versioning, and repository boundaries. Keep those decisions.

## 8. Recommended implementation order after this audit

1. Resolve the Phase 2 schema compatibility gaps through an additive migration before feature data is created.
2. Implement shared, pure financial domain functions (money conversion, account balance, transfer validation, budget windows, loan schedule/payment allocation, subscription date advancement).
3. Add deterministic unit tests for financial edge cases, especially month-end dates, leap years, partial payments, payment deletion/reallocation, transfer pairing, and multi-currency summaries.
4. Implement account and transaction repositories/use cases, including atomic paired transfers.
5. Add budgets, savings goals, loans, subscriptions, and activity features using the same domain rules.
6. Design and implement portable backup/restore only after the mobile schema and IDs are stable.

## 9. Explicit exclusions

- No changes were made to the web repository or its Supabase project.
- No production data was read, exported, modified, or deleted.
- No Supabase migration or account/auth changes were applied.
- No claim is made that the reviewed app or database passed runtime tests.
