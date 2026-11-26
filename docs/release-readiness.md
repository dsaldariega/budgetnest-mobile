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

- `npm run check` runs TypeScript validation followed by the automated test suite.
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
