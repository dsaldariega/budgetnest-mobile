# Project Structure

We use a feature-oriented Expo Router structure. Keep routes thin, feature code cohesive, and persistence/business rules outside UI components.

```text
budgetnest-mobile/
├── app/                         # Expo Router routes and navigation layouts
│   ├── (tabs)/                  # Main bottom-tab routes
│   └── _layout.tsx
├── assets/
│   ├── fonts/
│   └── images/
├── src/
│   ├── components/
│   │   ├── feedback/            # Loading, error, and empty states
│   │   ├── layout/              # Screen containers and shared layouts
│   │   └── ui/                  # Reusable buttons, inputs, cards
│   ├── features/
│   │   ├── dashboard/
│   │   ├── accounts/
│   │   ├── transactions/
│   │   ├── budgets/
│   │   ├── goals/
│   │   ├── loans/
│   │   ├── subscriptions/
│   │   └── settings/
│   ├── database/
│   │   ├── migrations/          # Ordered SQLite migrations
│   │   ├── repositories/        # SQLite data access
│   │   ├── provider.tsx         # Root SQLite provider
│   │   └── types.ts             # Persistence/domain-facing types
│   ├── services/
│   │   ├── backup/              # Portable backup, validation, restore
│   │   └── google-drive/        # Optional Drive integration
│   ├── theme/
│   ├── lib/
│   ├── hooks/
│   ├── constants/
│   └── types/
├── docs/
│   ├── architecture/
│   └── PROJECT_STRUCTURE.md
├── tests/
├── app.json
├── package.json
└── tsconfig.json
```

## Conventions

1. **Routes stay thin:** navigation and route composition only; no SQL or financial calculations.
2. **Feature-first:** feature-specific screens, components, hooks, services, and types live together under `src/features/<feature>/`.
3. **Shared UI:** promote components to `src/components` only when reused across features.
4. **Repository boundary:** UI calls feature services/repositories; raw SQL stays under `src/database`.
5. **Testable domain rules:** calculations and validation must not depend on React Native or SQLite.
6. **Optional integrations:** core functionality must work without Google sign-in or Drive.
7. **Avoid empty abstractions:** create detailed feature subfolders when the feature is implemented, not just to fill the tree.

## Database flow

```text
Expo Router screen → feature hook/service → domain rules → repository → SQLite
```

The web app remains the reference for existing behavior and visual identity. Mobile layouts should be redesigned for touch: bottom navigation, cards/lists instead of dense tables, and mobile-friendly dialogs or sheets.
