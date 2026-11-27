import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Appearance, useColorScheme } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import {
  createSettingsRepository,
  type ThemePreference,
} from "@/database/repositories/settings-repository";

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  mode: "light" | "dark";
  loading: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const systemMode = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void createSettingsRepository(db)
      .getThemePreference()
      .then((saved) => {
        if (mounted) setPreferenceState(saved);
      })
      .catch(() => {
        if (mounted) setPreferenceState("system");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [db]);

  useEffect(() => {
    if (!loading) {
      Appearance.setColorScheme(preference === "system" ? "unspecified" : preference);
    }
  }, [loading, preference]);

  const setPreference = useCallback(async (next: ThemePreference) => {
    await createSettingsRepository(db).setThemePreference(next);
    setPreferenceState(next);
  }, [db]);

  const value = useMemo<ThemePreferenceContextValue>(() => ({
    preference,
    mode: systemMode === "dark" ? "dark" : "light",
    loading,
    setPreference,
  }), [preference, systemMode, loading, setPreference]);

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const value = useContext(ThemePreferenceContext);
  if (!value) {
    throw new Error("useThemePreference must be used inside ThemePreferenceProvider.");
  }
  return value;
}
