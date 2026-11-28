import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function EmptyState({
  icon = "wallet-outline",
  title,
  message,
  actionLabel,
  onAction,
  palette,
  dark = false,
}: {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  palette: { surface: string; border: string; primary: string; text: string; textMuted: string };
  dark?: boolean;
}) {
  return (
    <View style={[s.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={[s.icon, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}>
        <MaterialCommunityIcons name={icon} size={28} color={palette.primary} />
      </View>
      <Text style={[s.title, { color: palette.text }]}>{title}</Text>
      <Text style={[s.message, { color: palette.textMuted }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={[s.button, { backgroundColor: palette.primary }]}>
          <Text style={s.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 23, alignItems: "center", marginTop: 5 },
  icon: { width: 54, height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { fontSize: 15, fontWeight: "800", textAlign: "center" },
  message: { textAlign: "center", fontSize: 12, lineHeight: 19, marginTop: 7 },
  button: { paddingHorizontal: 17, paddingVertical: 13, borderRadius: 13, alignItems: "center", marginTop: 17 },
  buttonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
