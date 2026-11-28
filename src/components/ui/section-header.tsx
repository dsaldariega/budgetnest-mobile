import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/theme/use-app-theme";
import { spacing } from "@/theme/tokens";

export function SectionHeader({ title, actionLabel, onAction }: {
  title: string; actionLabel?: string; onAction?: () => void;
}) {
  const { palette } = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} style={styles.action}>
          <Text style={[styles.actionText, { color: palette.primaryText }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md, marginBottom: spacing.md },
  title: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  action: { minHeight: 40, justifyContent: "center", paddingHorizontal: 4 },
  actionText: { fontSize: 13, fontWeight: "700" },
});