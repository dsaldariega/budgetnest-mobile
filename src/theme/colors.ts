export type ThemeColors = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  onPrimary: string;
  primaryText: string;
  primarySoft: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  border: string;
  disabled: string;
  income: string;
  expense: string;
  success: string;
  successSoft: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  overlay: string;
};

export const colors: Record<"light" | "dark", ThemeColors> = {
  light: {
    primary: "#D32F2F",
    primaryLight: "#EF5350",
    primaryDark: "#B71C1C",
    onPrimary: "#FFFFFF",
    primaryText: "#C62828",
    primarySoft: "#FDECEC",
    secondary: "#596575",
    background: "#F5F6F8",
    surface: "#FFFFFF",
    surfaceElevated: "#F0F2F5",
    text: "#20242A",
    textMuted: "#68717D",
    border: "#E1E5EA",
    disabled: "#AAB1BA",
    income: "#21845D",
    expense: "#C83F45",
    success: "#21845D",
    successSoft: "#E7F4EE",
    dangerSoft: "#FCEBEC",
    warning: "#94651C",
    warningSoft: "#FBF1DF",
    overlay: "rgba(18, 22, 28, 0.48)",
  },
  dark: {
    primary: "#EF5350",
    primaryLight: "#FF796D",
    primaryDark: "#C62828",
    onPrimary: "#1A1A1A",
    primaryText: "#FF796D",
    primarySoft: "#3A2224",
    secondary: "#A7AFB8",
    background: "#101214",
    surface: "#181B1F",
    surfaceElevated: "#22262B",
    text: "#F4F6F8",
    textMuted: "#A7AFB8",
    border: "#30363D",
    disabled: "#68717B",
    income: "#35A879",
    expense: "#D95757",
    success: "#35A879",
    successSoft: "#20372F",
    dangerSoft: "#382326",
    warning: "#D6A24A",
    warningSoft: "#382F20",
    overlay: "rgba(0, 0, 0, 0.68)",
  },
} as const;