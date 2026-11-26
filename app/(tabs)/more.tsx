import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";

const MENU = [
  { label: "Loans", description: "Manage borrowing and repayments.", icon: "bank-outline", route: "/loans" },
  { label: "Subscriptions", description: "Track recurring subscriptions.", icon: "calendar-clock", route: "/subscriptions" },
  { label: "Accounts", description: "Manage where your money is kept.", icon: "wallet-outline", route: "/accounts" },
  { label: "Recurring", description: "Manage recurring income and expenses.", icon: "repeat", route: "/recurring" },
  { label: "Reports", description: "Review financial summaries and trends.", icon: "chart-box-outline", route: "/reports" },
  { label: "Settings", description: "Preferences, Google backup, and data.", icon: "cog-outline", route: "/settings" },
] as const;

export default function MoreScreen() {
  const router = useRouter();
  const dark = useColorScheme() === "dark";
  const palette = dark ? colors.dark : colors.light;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: palette.primary }]}>BUDGETNEST</Text>
        <Text style={[styles.title, { color: palette.text }]}>More</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Everything else, organized in one spacious menu.
        </Text>

        <View style={styles.grid}>
          {MENU.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <View style={[styles.icon, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}>
                <MaterialCommunityIcons name={item.icon as never} size={23} color={palette.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: palette.text }]}>{item.label}</Text>
              <Text style={[styles.cardDescription, { color: palette.textMuted }]}>
                {item.description}
              </Text>
              <Text style={[styles.arrow, { color: palette.textMuted }]}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  title: { fontSize: 30, fontWeight: "800", marginTop: 4 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "48%",
    minHeight: 155,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    position: "relative",
  },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "800", marginTop: 14 },
  cardDescription: { fontSize: 12, lineHeight: 18, marginTop: 5, paddingRight: 8 },
  arrow: { position: "absolute", right: 14, bottom: 12, fontSize: 24 },
});
