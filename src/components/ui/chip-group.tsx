import { ScrollView, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useAppTheme } from "@/theme/use-app-theme";
import { radius, spacing } from "@/theme/tokens";

export type ChipOption = { value: string; label: string; disabled?: boolean };

export function ChipGroup({
  options, value, onChange, scrollable = false, style,
}: {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  scrollable?: boolean;
  style?: ViewStyle;
}) {
  const { palette } = useAppTheme();
  const chips = options.map(option => {
    const active = option.value === value;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="button"
        accessibilityState={{ selected: active, disabled: Boolean(option.disabled) }}
        disabled={option.disabled}
        onPress={() => onChange(option.value)}
        style={[styles.chip, { backgroundColor: active ? palette.primarySoft : palette.surface, borderColor: active ? palette.primary : palette.border, opacity: option.disabled ? 0.45 : 1 }]}
      >
        <Text style={[styles.label, { color: active ? palette.primaryText : palette.text }]}>{option.label}</Text>
      </Pressable>
    );
  });
  return scrollable ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, style]}>{chips}</ScrollView>
  ) : <View style={[styles.row, style]}>{chips}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minHeight: 40, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, fontWeight: "700" },
});