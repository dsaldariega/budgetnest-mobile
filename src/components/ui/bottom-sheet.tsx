import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@/theme/use-app-theme";
import { radius, spacing } from "@/theme/tokens";

export function BottomSheet({ visible, title, children, onClose, maxHeight = "82%" }: {
  visible: boolean; title: string; children: ReactNode; onClose: () => void; maxHeight?: number | `${number}%`;
}) {
  const { palette } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: palette.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss sheet" />
        <View style={[styles.sheet, { backgroundColor: palette.background, borderColor: palette.border, maxHeight }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <MaterialCommunityIcons name="close" size={20} color={palette.textMuted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: { width: "100%", borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, paddingTop: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  handle: { width: 38, height: 4, borderRadius: 4, backgroundColor: "#89919B", opacity: 0.55, alignSelf: "center", marginBottom: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  title: { fontSize: 18, fontWeight: "800" },
  close: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: spacing.lg, gap: spacing.md },
});