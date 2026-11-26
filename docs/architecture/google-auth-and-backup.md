# Google Authentication and Drive Backup

## Phase 20

BudgetNest remains local-first. Google authentication is optional and exists to unlock cloud backup and restore.

### Authentication

- Google Sign-In uses the native Google authentication integration.
- The app does not require a Google account for normal local finance tracking.
- The native sign-in session is restored when available.
- Sign-out removes the active Google session from BudgetNest.
- Google authentication requires a development or production native build; it is not supported by Expo Go.

### Backup access

Backup and restore are hidden from Settings until a Google account is signed in.

When the user chooses a backup feature, BudgetNest requests the narrow Google Drive app-data scope. This stores the application's backup in Google's private application-data area rather than exposing the backup as a normal Drive document.

The app uses the existing versioned JSON backup format. Google Drive is only a transport/storage destination; SQLite remains the source of truth.

### Google configuration

The project uses the react-native-nitro-google-signin Expo config plugin.

For development, configure a Google Cloud project with:

1. Android OAuth client for com.dsaldariega.budgetnest and the development build SHA-1.
2. Web OAuth client ID used by Google Sign-In.
3. Google Drive API enabled.
4. OAuth consent screen configured for the requested Drive app-data scope.

The Web client ID may be supplied with EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. When Google service configuration files are supplied, the native library can auto-detect the Web client ID.

### Security boundary

The app requests only the Drive app-data scope for BudgetNest backups. It does not request broad Drive access.

Google access tokens are kept in the native authentication/session layer and are not written to SQLite or the portable backup file.
