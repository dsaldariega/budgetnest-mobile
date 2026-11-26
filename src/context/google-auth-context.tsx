import Constants from "expo-constants";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { OneTapSuccessData } from "react-native-nitro-google-signin";

type GoogleAuthContextValue = {
  user: OneTapSuccessData | null;
  loading: boolean;
  signingIn: boolean;
  error: string;
  isGoogleAuthAvailable: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getDriveToken: () => Promise<string>;
  clearError: () => void;
};

const GoogleAuthContext = createContext<GoogleAuthContextValue | null>(null);
const isExpoGo = Constants.executionEnvironment === "storeClient";

export function GoogleAuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<OneTapSuccessData | null>(null);
  const [loading, setLoading] = useState(!isExpoGo);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Expo Go does not include the native Nitro module. Skip importing it
    // entirely so local SQLite features remain usable in the Expo Go client.
    if (isExpoGo) {
      setUser(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    void import("@/services/google/google-auth")
      .then(({ configureGoogleAuth, restoreGoogleUser }) => {
        configureGoogleAuth();
        const restoredUser = restoreGoogleUser();
        if (mounted) setUser(restoredUser);
      })
      .catch(() => {
        // Google is optional. A native auth issue must not block local use.
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async () => {
    setError("");
    if (isExpoGo) {
      const message = "Google Sign-In requires a BudgetNest development build. Expo Go does not include the required native Nitro module. You can continue using BudgetNest locally without Google.";
      setError(message);
      throw new Error(message);
    }

    setSigningIn(true);
    try {
      const { signInWithGoogle } = await import("@/services/google/google-auth");
      setUser(await signInWithGoogle());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in with Google.");
      throw e;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError("");
    try {
      const { signOutFromGoogle } = await import("@/services/google/google-auth");
      await signOutFromGoogle();
      setUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign out of Google.");
      throw e;
    }
  }, []);

  const getDriveToken = useCallback(async () => {
    if (isExpoGo) {
      throw new Error("Google Drive backup requires a BudgetNest development build.");
    }
    const { getDriveAccessToken } = await import("@/services/google/google-auth");
    return getDriveAccessToken();
  }, []);

  const clearError = useCallback(() => setError(""), []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signingIn,
      error,
      isGoogleAuthAvailable: !isExpoGo,
      signIn,
      signOut,
      getDriveToken,
      clearError,
    }),
    [user, loading, signingIn, error, signIn, signOut, getDriveToken, clearError],
  );

  return (
    <GoogleAuthContext.Provider value={value}>
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth(): GoogleAuthContextValue {
  const value = useContext(GoogleAuthContext);
  if (!value) {
    throw new Error("useGoogleAuth must be used inside GoogleAuthProvider.");
  }
  return value;
}
