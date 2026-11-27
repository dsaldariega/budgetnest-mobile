# Architecture Decisions

## Agreed direction
- Mobile is the primary BudgetNest experience.
- Expo + React Native + TypeScript.
- Local-first operation with SQLite.
- No mandatory account or login.
- Google identity and Drive access are optional backup capabilities.
- Implement snapshot backup/restore before considering automatic synchronization.
- Keep the existing web app and Supabase infrastructure intact during the audit and mobile transition.

## Database
See [Local database architecture](database.md) for the initial SQLite schema, migration strategy, money representation, repository boundary, and known limitations.

## Audit required before finalizing
- Existing web data model, Supabase schema, and migrations.
- Financial calculations and validation rules.
- Current export/import behavior and backup compatibility.
- OAuth scopes, encryption, and recovery design.
- Whether domain logic can later be extracted into a shared package.

Do not remove Supabase or migrate/delete existing data until the full audit and migration plan are reviewed and approved.
