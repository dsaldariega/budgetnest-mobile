import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";

export default function DashboardScreen() {
  const isDark = useColorScheme() === "dark";
  const palette = isDark ? colors.dark : colors.light;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.brand, { color: palette.primary }]}>BudgetNest</Text>
            <Text style={[styles.greeting, { color: palette.text }]}>Your finances, in one place.</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: isDark ? "#3A2424" : "#FCE8E8" }]}>
            <Text style={[styles.avatarText, { color: palette.primary }]}>B</Text>
          </View>
        </View>

        <View style={[styles.welcomeCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.cardEyebrow, { color: palette.textMuted }]}>WELCOME TO BUDGETNEST</Text>
          <Text style={[styles.cardTitle, { color: palette.text }]}>A calmer way to manage your money.</Text>
          <Text style={[styles.cardDescription, { color: palette.textMuted }]}>
            Your personal finance workspace is being prepared. Your information will stay on this device by default.
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={[styles.statusText, { color: palette.textMuted }]}>Mobile foundation is ready to build on</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>Your overview</Text>
        <View style={styles.grid}>
          <View style={[styles.infoCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.infoLabel, { color: palette.textMuted }]}>Accounts</Text>
            <Text style={[styles.infoValue, { color: palette.text }]}>Coming soon</Text>
          </View>
          <View style={[styles.infoCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.infoLabel, { color: palette.textMuted }]}>Transactions</Text>
            <Text style={[styles.infoValue, { color: palette.text }]}>Coming soon</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28 },
  brand: { fontSize: 15, fontWeight: "800", letterSpacing: 0.2 },
  greeting: { fontSize: 23, fontWeight: "700", letterSpacing: -0.5, marginTop: 5 },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "800" },
  welcomeCard: { borderWidth: 1, borderRadius: 18, padding: 20, marginBottom: 28 },
  cardEyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1, marginBottom: 12 },
  cardTitle: { fontSize: 23, lineHeight: 29, fontWeight: "700", letterSpacing: -0.4 },
  cardDescription: { fontSize: 14, lineHeight: 22, marginTop: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#2E7D32", marginRight: 8 },
  statusText: { fontSize: 12, fontWeight: "500" },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  grid: { flexDirection: "row", gap: 12 },
  infoCard: { flex: 1, minHeight: 104, borderWidth: 1, borderRadius: 16, padding: 16, justifyContent: "space-between" },
  infoLabel: { fontSize: 13, fontWeight: "500" },
  infoValue: { fontSize: 15, fontWeight: "700" },
});
