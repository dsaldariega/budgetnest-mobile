export type ThemeColors = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  income: string;
  expense: string;
  success: string;
  warning: string;
};

export const colors: Record<"light" | "dark", ThemeColors> = {
  light: {
    primary: "#D32F2F",
    primaryLight: "#EF5350",
    primaryDark: "#B71C1C",
    secondary: "#455A64",
    background: "#F7F8FA",
    surface: "#FFFFFF",
    text: "#1F2937",
    textMuted: "#64748B",
    border: "rgba(15, 23, 42, 0.10)",
    income: "#2E7D32",
    expense: "#ED6C02",
    success: "#2E7D32",
    warning: "#ED6C02",
  },
  dark: {
    primary: "#EF5350",
    primaryLight: "#FF867C",
    primaryDark: "#B71C1C",
    secondary: "#90A4AE",
    background: "#121212",
    surface: "#1E1E1E",
    text: "rgba(255, 255, 255, 0.92)",
    textMuted: "rgba(255, 255, 255, 0.62)",
    border: "rgba(255, 255, 255, 0.12)",
    income: "#66BB6A",
    expense: "#FFB74D",
    success: "#66BB6A",
    warning: "#FFB74D",
  },
} as const;
