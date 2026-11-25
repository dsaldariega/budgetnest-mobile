# BudgetNest Mobile

Mobile-first BudgetNest application built with Expo, React Native, and TypeScript.

## Git workflow
- `main` is production and contains only tested, approved releases.
- `dev` is the active development and integration branch.
- Each completed phase must be represented by one commit on `dev`.
- Test and review a phase before merging `dev` into `main`.

## Product direction
- Local-first and offline-capable; SQLite is the mobile source of truth.
- No account is required for core app usage.
- Google sign-in and Drive backup are optional.
- Backups use a versioned portable format, not a raw SQLite file.
- Existing BudgetNest web behavior and visual design are references; mobile gets touch-first layouts.

See [Project structure](docs/PROJECT_STRUCTURE.md) and [Architecture decisions](docs/architecture/README.md).
