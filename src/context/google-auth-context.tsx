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
import {
  configureGoogleAuth,
  getDriveAccessToken,
  restoreGoogleUser,
  signInWithGoogle,
  signOutFromGoogle,
} from "@/services/google/google-auth";

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
    try {
      configureGoogleAuth();
      setUser(restoreGoogleUser());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in is not available.");
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async () => {
    setError("");
    setSigningIn(true);
    try {
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
      await signOutFromGoogle();
      setUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign out of Google.");
      throw e;
    }
  }, []);

  const getDriveToken = useCallback(async () => getDriveAccessToken(), []);

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
