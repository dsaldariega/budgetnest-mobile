import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { useAppTheme } from "@/theme/use-app-theme";
import { controlSize, radius } from "@/theme/tokens";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

export function Button({
  label, onPress, variant = "primary", disabled = false, loading = false,
  icon, fullWidth = false, style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useAppTheme();
  const background = variant === "primary" ? palette.primary
    : variant === "secondary" ? palette.surfaceElevated
    : variant === "danger" ? palette.expense
    : "transparent";
  const foreground = variant === "primary" || variant === "danger" ? palette.onPrimary
    : variant === "outline" || variant === "ghost" ? palette.primaryText
    : palette.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor: variant === "outline" ? palette.border : background, opacity: disabled ? 0.48 : pressed ? 0.82 : 1 },
        variant === "outline" && styles.outline,
        variant === "ghost" && styles.ghost,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={foreground} /> : icon}
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: controlSize.buttonHeight, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  outline: { backgroundColor: "transparent" },
  ghost: { borderColor: "transparent" },
  fullWidth: { alignSelf: "stretch" },
  label: { fontSize: 14, fontWeight: "700" },
});