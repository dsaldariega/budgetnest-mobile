import {
  GoogleOneTapSignIn,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
  type OneTapSuccessData,
} from "react-native-nitro-google-signin";

export const GOOGLE_DRIVE_APP_DATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata";

let configured = false;

function getWebClientId(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || "autoDetect";
}

export function configureGoogleAuth(): void {
  if (configured) return;

  GoogleOneTapSignIn.configure({
    webClientId: getWebClientId(),
    offlineAccess: false,
  });

  configured = true;
}

export function restoreGoogleUser(): OneTapSuccessData | null {
  configureGoogleAuth();
  return GoogleOneTapSignIn.getCurrentUser();
}

export async function signInWithGoogle(): Promise<OneTapSuccessData> {
  configureGoogleAuth();
  await GoogleOneTapSignIn.checkPlayServices();

  let response = await GoogleOneTapSignIn.signIn();

  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.createAccount();
  }

  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.presentExplicitSignIn();
  }

  if (!isSuccessResponse(response)) {
    throw new Error("Google sign-in did not complete.");
  }

  return response.data;
}

export async function signOutFromGoogle(): Promise<void> {
  configureGoogleAuth();
  await GoogleOneTapSignIn.signOut();
}

export async function getDriveAccessToken(): Promise<string> {
  configureGoogleAuth();

  const current = GoogleOneTapSignIn.getCurrentUser();
  if (!current) {
    throw new Error("Sign in with Google before using backup and restore.");
  }

  if (!current.scopes.includes(GOOGLE_DRIVE_APP_DATA_SCOPE)) {
    const authorization = await GoogleOneTapSignIn.requestScopes([
      GOOGLE_DRIVE_APP_DATA_SCOPE,
    ]);

    if (!authorization.accessToken) {
      throw new Error("Google Drive access was not granted.");
    }

    return authorization.accessToken;
  }

  const tokens = await GoogleOneTapSignIn.getTokens();
  return tokens.accessToken;
}
