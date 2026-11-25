# BudgetNest Mobile

The mobile-first BudgetNest application, built with Expo, React Native, and TypeScript.

## Git workflow

- `main` is production and contains only tested, approved releases.
- `dev` is the active development and integration branch.
- Each completed phase must be represented by exactly one commit on `dev`.
- Test and review a phase before merging `dev` into `main`.

## Tech foundation

- Expo SDK 58 + Expo Router.
- React Native 0.88 + React 19.3 + TypeScript.
- Mobile-first navigation with bottom tabs.
- Shared visual language based on the existing BudgetNest web app.
- Local-first direction; SQLite will be introduced in a later phase.

## Run locally

Requires Node.js 22.13 or newer for Expo SDK 58.

```bash
npm install
npx expo install --fix
npx expo-doctor
npm run typecheck
npx expo start
```

To run on Android, press `a` in the Expo terminal or run `npm run android`. For a physical Android device, install the compatible Expo Go app and scan the QR code.

## Project direction

- Core features should work offline without mandatory sign-in.
- SQLite will be the mobile source of truth.
- Google sign-in and Drive backup will be optional capabilities.
- Backups will use a versioned portable format, not a raw SQLite database file.
- Existing BudgetNest web behavior and visual design are references; mobile gets touch-first layouts.

See [Project structure](docs/PROJECT_STRUCTURE.md) and [Architecture decisions](docs/architecture/README.md).
