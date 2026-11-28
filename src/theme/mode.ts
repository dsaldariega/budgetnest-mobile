import type { ThemePreference } from "@/database/repositories/settings-repository";

export function resolveThemeMode(preference: ThemePreference, systemMode: "light" | "dark" | null | undefined): "light" | "dark" {
  return preference === "system" ? (systemMode === "dark" ? "dark" : "light") : preference;
}