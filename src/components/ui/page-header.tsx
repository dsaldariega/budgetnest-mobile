import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/theme/use-app-theme";
import { radius, spacing } from "@/theme/tokens";

export function PageHeader({ title, subtitle, showBack = true, rightAction, onRightAction }: {
  title: string; subtitle?: string; showBack?: boolean; rightAction?: string; onRightAction?: () => void;
}) {
  const router = useRouter();
  const { palette } = useAppTheme();
  return (
    <View style={styles.row}>
      {showBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={palette.text} />
        </Pressable>
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: palette.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {rightAction && onRightAction ? <Pressable onPress={onRightAction} hitSlop={8}><Text style={[styles.action, { color: palette.primaryText }]}>{rightAction}</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  back: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  action: { fontSize: 13, fontWeight: "700" },
});