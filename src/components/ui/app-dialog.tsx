import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useAppTheme } from "@/theme/use-app-theme";
import { radius, spacing } from "@/theme/tokens";
import { Button } from "@/components/ui/button";

export function AppDialog({ visible, title, message, children, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel, destructive = false, busy = false }: {
  visible: boolean; title: string; message?: string; children?: ReactNode; confirmLabel?: string; cancelLabel?: string;
  onConfirm: () => void; onCancel: () => void; destructive?: boolean; busy?: boolean;
}) {
  const { palette } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.backdrop, { backgroundColor: palette.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Dismiss dialog" />
        <View accessibilityRole="alert" style={[styles.dialog, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: palette.textMuted }]}>{message}</Text> : null}
          {children}
          <View style={styles.actions}>
            <View style={styles.action}><Button label={cancelLabel} variant="outline" onPress={onCancel} /></View>
            <View style={styles.action}><Button label={confirmLabel} variant={destructive ? "danger" : "primary"} onPress={onConfirm} loading={busy} /></View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  dialog: { width: "100%", maxWidth: 440, borderWidth: 1, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 19, fontWeight: "800" },
  message: { fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1 },
});