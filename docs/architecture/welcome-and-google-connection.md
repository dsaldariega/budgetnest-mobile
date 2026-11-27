# Welcome Experience and Optional Google Connection

## Signed-out entry flow

The root route checks the restored Google session before choosing the first screen:

- A connected Google user is sent directly to the tab dashboard.
- A signed-out user sees the welcome slides on each fresh app launch.
- Closing the welcome or choosing Continue without Google enters the local app for the current session.
- The next cold launch shows the welcome again if the user is still signed out.

The welcome screen introduces BudgetNest's account overview, budgeting and planning tools, and local-first privacy model. The final slide explains optional Google Drive backup and restore.

## Google connection

Google connection is initiated only after an explicit user action from the welcome flow or Settings. The shared connection modal explains why Google is requested and allows the user to cancel.

Authentication errors remain inside the connection modal. They do not interrupt local finance tracking or appear as an app-launch error.

## Data and privacy

SQLite remains the source of truth. No Google account is required for accounts, transactions, budgets, savings goals, recurring items, loans, or reports. Google is used for the optional backup and restore workflow only.

Google authentication requires a native development or production build; Expo Go does not support the native sign-in integration.
