import { ReactNode } from "react";
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";

type Props = {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PlaceholderScreen({ eyebrow, title, description, children }: Props) {
  const isDark = useColorScheme() === "dark";
  const palette = isDark ? colors.dark : colors.light;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
      <View style={styles.content}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: palette.primary }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.description, { color: palette.textMuted }]}>{description}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.6 },
  description: { fontSize: 15, lineHeight: 23, marginTop: 10 },
});
