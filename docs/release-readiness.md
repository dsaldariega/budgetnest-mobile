# Release Readiness & Device Testing

## Current release posture

BudgetNest Mobile is a local-first Expo application. A successful typecheck and unit-test run is necessary but does not replace a native Android build or hands-on device testing.

This phase adds repeatable checks and EAS build profiles. It does not submit the app to an app store, create signing credentials, configure cloud sync, or merge development into production.

## Quality checks

Run from the repository root:

```bash
npm install
npm run check
npm run doctor
npx expo config --type public
```

- `npm run check` runs TypeScript validation, the automated Node test suite, and a production Android bundle export through Expo/Metro. The export catches app-wide route, import, and bundling failures; it does not replace device interaction testing.
- `npm run test:runtime` can be run separately when only the Expo/Metro bundle smoke test is needed.
- `npm run doctor` runs Expo's project compatibility checks.
- Review the resolved public Expo config before producing a build.

## Android build profiles

The repository includes two EAS Build profiles:

- `preview`: internally distributed Android APK for installation and custodian/developer testing.
- `production`: Android App Bundle intended for a later store release.

Before the first EAS build, authenticate with the intended Expo account and run the EAS build configuration flow. Confirm the Expo project ownership and generated project ID before committing any generated configuration. Do not share signing credentials or upload keystores to Git.

Preview build:

```bash
eas build --profile preview --platform android
```

Production build (only after approval and successful testing):

```bash
eas build --profile production --platform android
```

The production profile is configuration only; it is not authorization to publish.

## Application runtime and UI smoke test

After `npm run check` passes, start the app with `npx expo start` and open it in Expo Go or a compatible development build. Use disposable test data for destructive flows.

### Navigation and shared runtime
- [ ] App opens to the welcome screen when signed out and reaches the main tabs after the configured sign-in flow.
- [ ] Visit every bottom tab and every More/stack screen; confirm there are no red screens, stuck loading states, or missing route errors.
- [ ] Switch light/dark appearance and verify the current screen updates without restarting.
- [ ] Background and reopen the app; confirm SQLite data remains available.

### Accounts and transaction UI
- [ ] Create two active PHP accounts; verify both appear in account selectors.
- [ ] Open Add transaction, choose Transfer, and confirm the default source and destination are different.
- [ ] Change the source account; confirm the destination remains different or is automatically replaced.
- [ ] Save a transfer and verify both account balances; edit it and confirm both sides update; delete it and confirm both sides reverse.
- [ ] Try invalid amounts, missing required fields, and same-account transfers; confirm a clear validation message appears and no data is written.
- [ ] Add/edit/delete income and expense entries; verify Activity and Dashboard refresh when returning to those screens.
- [ ] Search and filter Activity; clear filters and verify the full list returns.

### Connected features
- [ ] Create a loan, open its details, record a payment, and verify the payment history and remaining balance.
- [ ] Create a subscription, record a payment, verify its next billing date, then delete the payment and verify the date rolls back.
- [ ] Create a recurring rule and generate due entries; run generation again and verify duplicates are skipped.
- [ ] Create a budget and savings goal; add a goal contribution and verify progress.
- [ ] Open Reports and switch month, 3-month, and year periods; confirm currencies remain separated.

### Settings and backup
- [ ] Change the default currency and confirm it affects new accounts only.
- [ ] Export a backup to Google Drive using a connected test account.
- [ ] Select a valid backup, cancel the restore confirmation, and confirm current data remains unchanged.
- [ ] Restore a valid test backup and verify key records; do not use a backup containing the only copy of important data.

## Android device test checklist

### Install and launch
- [ ] Install the preview APK on a clean Android device.
- [ ] App launches without a red screen or database migration error.
- [ ] App can be closed and reopened without losing saved data.
- [ ] Status bar, navigation bar, keyboard, and safe areas do not cover controls.
- [ ] Light and dark system appearance are readable.

### Accounts and transactions
- [ ] Create cash, bank, and e-wallet accounts with different currencies.
- [ ] Default currency preference is applied to newly created accounts.
- [ ] Changing the default currency does not change existing accounts.
- [ ] Add income and expenses; verify account balances.
- [ ] Transfer between same-currency accounts; verify both balances.
- [ ] Confirm invalid cross-currency transfers are blocked.
- [ ] Archive an account and confirm its history remains available.

### Budgets, goals, loans, subscriptions, recurring
- [ ] Create and review a budget.
- [ ] Create a savings goal and add a contribution.
- [ ] Create a loan and record repayments; verify remaining balance.
- [ ] Create a subscription and record a payment.
- [ ] Create a recurring rule and explicitly generate due occurrences.
- [ ] Generate recurring occurrences more than once; confirm duplicates are not created.

### Activity and reports
- [ ] Search and filter activity by type, date, account, and category.
- [ ] Review reports for month, trailing three months, and year.
- [ ] Confirm different currencies are shown separately, never added together.

### Backup and restore (use test data first)
- [ ] Export a backup and confirm the JSON file can be shared/saved.
- [ ] Import a valid backup and inspect the restore confirmation details.
- [ ] Cancel restore and confirm current data remains unchanged.
- [ ] Restore a valid backup and verify accounts, transactions, and related records.
- [ ] Try a modified/corrupted backup and confirm restore is rejected.
- [ ] Keep a separate copy of important data before testing restore.

### Offline and resilience
- [ ] Use core screens with Wi-Fi and mobile data disabled.
- [ ] Force-close and reopen the app after creating records.
- [ ] Navigate between all tabs and stack screens.
- [ ] Check empty states, validation messages, and long lists on a smaller screen.

## Release blockers still requiring a human/device check

- Real Android build and installation.
- App icon, splash/branding assets, and final visual review.
- Android version/device compatibility and keyboard behavior.
- Backup export/import through real Android document and share providers.
- Final package identity, store listing, privacy policy, and signing ownership before store submission.

## Release branch policy

- Continue development and fixes on `dev`.
- Do not merge to `main` until typecheck, tests, Expo Doctor, preview build, and the device checklist have been reviewed.
- Keep one completed phase per commit.
