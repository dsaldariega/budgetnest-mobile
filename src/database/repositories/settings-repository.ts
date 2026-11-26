import type { SQLiteDatabase } from "expo-sqlite";

export const DEFAULT_CURRENCY_CODE = "PHP";
export const SUPPORTED_DEFAULT_CURRENCIES = [
  { code: "PHP", label: "Philippine Peso" },
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British Pound" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "SGD", label: "Singapore Dollar" },
  { code: "JPY", label: "Japanese Yen" },
] as const;

export type DefaultCurrencyCode = (typeof SUPPORTED_DEFAULT_CURRENCIES)[number]["code"];

export type ThemePreference = "system" | "light" | "dark";

export function isThemePreference(value: string): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function isSupportedDefaultCurrency(value: string): value is DefaultCurrencyCode {
  return SUPPORTED_DEFAULT_CURRENCIES.some((currency) => currency.code === value);
}

export function createSettingsRepository(db: SQLiteDatabase) {
  return {
    async getThemePreference(): Promise<ThemePreference> {
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_settings WHERE key = ?",
        "theme_preference",
      );
      return row && isThemePreference(row.value) ? row.value : "system";
    },
    async setThemePreference(preference: ThemePreference): Promise<void> {
      if (!isThemePreference(preference)) throw new Error("Choose a valid appearance preference.");
      await db.runAsync(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        "theme_preference", preference, new Date().toISOString(),
      );
    },
    async getDefaultCurrency(): Promise<DefaultCurrencyCode> {
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_settings WHERE key = ?",
        "default_currency_code",
      );
      return row && isSupportedDefaultCurrency(row.value)
        ? row.value
        : DEFAULT_CURRENCY_CODE;
    },
    async setDefaultCurrency(currencyCode: string): Promise<void> {
      if (!isSupportedDefaultCurrency(currencyCode)) {
        throw new Error("Choose a supported default currency.");
      }
      await db.runAsync(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        "default_currency_code",
        currencyCode,
        new Date().toISOString(),
      );
    },
    async getDataOverview(): Promise<{ counts: Record<string, number>; schemaVersion: number }> {
      const tables = [
        "accounts", "categories", "transactions", "budgets", "savings_goals",
        "goal_contributions", "subscriptions", "subscription_payments", "loans",
        "loan_payments", "recurring_rules",
      ];
      const counts: Record<string, number> = {};
      for (const table of tables) {
        const row = await db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) AS count FROM " + table,
        );
        counts[table] = row?.count ?? 0;
      }
      const version = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
      return { counts, schemaVersion: version?.user_version ?? 0 };
    },
  };
}
