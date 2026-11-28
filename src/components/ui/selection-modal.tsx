import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useAppTheme } from "@/theme/use-app-theme";
import { radius, spacing } from "@/theme/tokens";

export type SelectionOption = { value: string; label: string; description?: string };

export function SelectionModal({ visible, title, options, value, onSelect, onClose, emptyMessage = "No options available." }: {
  visible: boolean; title: string; options: SelectionOption[]; value: string; onSelect: (value: string) => void; onClose: () => void; emptyMessage?: string;
}) {
  const { palette } = useAppTheme();
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      {options.length === 0 ? <Text style={[styles.empty, { color: palette.textMuted }]}>{emptyMessage}</Text> : (
        <View style={styles.list}>
          {options.map(item => {
            const active = item.value === value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => { onSelect(item.value); onClose(); }}
                style={[styles.option, { backgroundColor: active ? palette.primarySoft : palette.surface, borderColor: active ? palette.primary : palette.border }]}
              >
                <View style={styles.copy}>
                  <Text style={[styles.label, { color: active ? palette.primaryText : palette.text }]}>{item.label}</Text>
                  {item.description ? <Text style={[styles.description, { color: palette.textMuted }]}>{item.description}</Text> : null}
                </View>
                {active ? <MaterialCommunityIcons name="check" size={20} color={palette.primaryText} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  option: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md },
  copy: { flex: 1, minWidth: 0 },
  label: { fontSize: 14, fontWeight: "700" },
  description: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  empty: { fontSize: 13, padding: spacing.lg },
});