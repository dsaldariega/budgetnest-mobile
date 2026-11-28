import { useThemePreference } from "@/context/theme-context";
import { colors } from "@/theme/colors";
export { resolveThemeMode } from "@/theme/mode";
import type { ThemePreference } from "@/database/repositories/settings-repository";

export function useAppTheme() {
  const { mode, preference, loading, setPreference } = useThemePreference();
  return {
    mode,
    isDark: mode === "dark",
    palette: colors[mode],
    preference,
    loading,
    setPreference,
  } as const;
}