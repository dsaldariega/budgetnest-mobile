# Expo Go compatibility and optional Google Sign-In

BudgetNest is local-first. Expo Go does not contain the native Nitro module required by `react-native-nitro-google-signin`.

- The Google auth provider detects Expo Go and skips loading/configuring the native Google module.
- Local SQLite features, onboarding, tabs, and Settings remain available in Expo Go.
- The Google connection modal explains that Google Sign-In and Drive backup require a custom BudgetNest development build.
- In a development or production build, Google auth restoration and Drive backup remain available.

Use Expo Go for UI and local database feature testing. Use a custom development build to test Google Sign-In and Google Drive backup/restore.
