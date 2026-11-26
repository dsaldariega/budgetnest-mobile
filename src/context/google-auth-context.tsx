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
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getDriveToken: () => Promise<string>;
  clearError: () => void;
};

const GoogleAuthContext = createContext<GoogleAuthContextValue | null>(null);

export function GoogleAuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<OneTapSuccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    void import("@/services/google/google-auth")
      .then(({ configureGoogleAuth, restoreGoogleUser }) => {
        configureGoogleAuth();
        const restoredUser = restoreGoogleUser();
        if (mounted) setUser(restoredUser);
      })
      .catch((e: unknown) => {
        if (mounted) {
          setError(
            e instanceof Error
              ? e.message
              : "Google sign-in is unavailable in this build.",
          );
        }
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
    const { getDriveAccessToken } = await import("@/services/google/google-auth");
    return getDriveAccessToken();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signingIn,
      error,
      signIn,
      signOut,
      getDriveToken,
      clearError: () => setError(""),
    }),
    [user, loading, signingIn, error, signIn, signOut, getDriveToken],
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
