import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useAppTheme } from "@/theme/use-app-theme";
import { radius, spacing } from "@/theme/tokens";

export function SummaryCard({ title, value, caption, icon, children }: {
  title: string; value?: string; caption?: string; icon?: ReactNode; children?: ReactNode;
}) {
  const { palette } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: palette.textMuted }]}>{title}</Text>
        {icon}
      </View>
      {value !== undefined ? <Text style={[styles.value, { color: palette.text }]}>{value}</Text> : null}
      {caption ? <Text style={[styles.caption, { color: palette.textMuted }]}>{caption}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 12, fontWeight: "700" },
  value: { fontSize: 23, fontWeight: "800", letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  caption: { fontSize: 12, lineHeight: 17 },
});