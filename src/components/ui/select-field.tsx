import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SelectionModal, type SelectionOption } from "@/components/ui/selection-modal";
import { useState } from "react";
import { useAppTheme } from "@/theme/use-app-theme";
import { controlSize, radius, spacing } from "@/theme/tokens";

export type SelectOption = SelectionOption;

export function SelectField({
  label,
  value,
  options,
  placeholder = "Select",
  onChange,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const { palette } = useAppTheme();
  const selected = options.find(option => option.value === value);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Text style={[styles.label, { color: palette.text }]}>{label}{required ? " *" : ""}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label + ": " + (selected?.label ?? placeholder)}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: palette.surface, borderColor: palette.border, opacity: disabled ? 0.55 : 1 }]}
      >
        <View style={styles.copy}>
          <Text style={{ color: selected ? palette.text : palette.textMuted, fontSize: 14, fontWeight: selected ? "700" : "500" }}>
            {selected?.label ?? placeholder}
          </Text>
          {selected?.description ? <Text style={{ color: palette.textMuted, fontSize: 11, marginTop: 3 }}>{selected.description}</Text> : null}
        </View>
        <MaterialCommunityIcons name="chevron-down" size={20} color={palette.textMuted} />
      </Pressable>
      <SelectionModal
        visible={open}
        title={label}
        options={options}
        value={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm },
  field: { minHeight: controlSize.minHeight, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: spacing.md },
  copy: { flex: 1, minWidth: 0 },
});