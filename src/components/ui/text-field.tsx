import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "@/theme/use-app-theme";
import { controlSize, radius, spacing, typography } from "@/theme/tokens";

export function TextField({
  label, error, helperText, required = false, containerStyle, ...inputProps
}: TextInputProps & {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const { palette } = useAppTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.container, { marginTop: spacing.lg }, containerStyle]}>
      <Text style={[styles.label, { color: palette.text }]}>{label}{required ? " *" : ""}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        placeholderTextColor={palette.textMuted}
        onFocus={(event) => { setFocused(true); inputProps.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); inputProps.onBlur?.(event); }}
        style={[
          styles.input,
          { color: palette.text, backgroundColor: palette.surface, borderColor: error ? palette.expense : focused ? palette.primary : palette.border },
          inputProps.style,
        ]}
      />
      {error || helperText ? <Text style={[styles.helper, { color: error ? palette.expense : palette.textMuted }]}>{error ?? helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { fontSize: typography.label, fontWeight: "700" },
  input: { minHeight: controlSize.minHeight, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  helper: { fontSize: 12, lineHeight: 17 },
});