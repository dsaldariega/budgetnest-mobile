# BudgetNest Mobile

The mobile-first BudgetNest application, built with Expo, React Native, and TypeScript.

## Git workflow
- `main` is production and contains only tested, approved releases.
- `dev` is the active development and integration branch.
- Each completed phase is represented by exactly one commit on `dev`.
- Test and review a phase before merging `dev` into `main`.

## Tech foundation
- Expo SDK 58 + Expo Router.
- React Native 0.88 + React 19.3 + TypeScript.
- Local-first SQLite database and framework-independent financial domain logic.
- Touch-first screens with a shared BudgetNest visual language.

## Run locally
Requires Node.js 22.13 or newer for Expo SDK 58.

```bash
npm install
npx expo install --fix
npx expo-doctor
npm run typecheck
npm test
npx expo start
```

## Project direction
- Core features work offline without mandatory sign-in.
- SQLite is the mobile source of truth.
- Google sign-in and Drive backup will be optional capabilities.
- Backups will use a versioned portable format, not a raw SQLite database file.
- Existing BudgetNest web behavior and visual design are references; mobile gets touch-first layouts.

See [Project structure](docs/PROJECT_STRUCTURE.md) and [Architecture decisions](docs/architecture/README.md).
