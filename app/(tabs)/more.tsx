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
import { BudgetNestBrand } from "@/components/ui/budgetnest-brand";

const MENU_GROUPS = [
  {
    title: "Money",
    items: [
      {
        label: "Accounts",
        description: "Manage your cash, bank, and e-wallet accounts.",
        icon: "wallet-outline",
        route: "/accounts",
      },
    ],
  },
  {
    title: "Commitments",
    items: [
      {
        label: "Loans",
        description: "Track loan balances, terms, and repayments.",
        icon: "bank-outline",
        route: "/loans",
      },
      {
        label: "Subscriptions",
        description: "Keep track of recurring bills and payments.",
        icon: "calendar-clock",
        route: "/subscriptions",
      },
      {
        label: "Recurring",
        description: "Plan regular income and expense entries.",
        icon: "repeat",
        route: "/recurring",
      },
    ],
  },
  {
    title: "Insights",
    items: [
      {
        label: "Reports",
        description: "Review cash flow, spending, and monthly trends.",
        icon: "chart-box-outline",
        route: "/reports",
      },
    ],
  },
  {
    title: "Preferences",
    items: [
      {
        label: "Settings",
        description: "Manage currency, appearance, backup, and data.",
        icon: "cog-outline",
        route: "/settings",
      },
    ],
  },
] as const;

export default function MoreScreen() {
  const router = useRouter();
  const dark = useColorScheme() === "dark";
  const palette = dark ? colors.dark : colors.light;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.background }]}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <BudgetNestBrand color={palette.text} size={38} />
        <Text style={[styles.title, { color: palette.text }]}>More</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Explore the rest of your financial workspace.
        </Text>

        {MENU_GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={[styles.groupTitle, { color: palette.textMuted }]}>
              {group.title.toUpperCase()}
            </Text>
            <View
              style={[
                styles.groupCard,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              {group.items.map((item, index) => (
                <View key={item.route}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    onPress={() => router.push(item.route)}
                    style={({ pressed }) => [
                      styles.menuItem,
                      { opacity: pressed ? 0.65 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.icon,
                        { backgroundColor: dark ? "#3A2424" : "#FCE8E8" },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={21}
                        color={palette.primary}
                      />
                    </View>
                    <View style={styles.itemCopy}>
                      <Text style={[styles.itemTitle, { color: palette.text }]}>
                        {item.label}
                      </Text>
                      <Text
                        style={[styles.itemDescription, { color: palette.textMuted }]}
                      >
                        {item.description}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={22}
                      color={palette.textMuted}
                    />
                  </Pressable>
                  {index < group.items.length - 1 ? (
                    <View
                      style={[
                        styles.separator,
                        { backgroundColor: palette.border },
                      ]}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  title: { fontSize: 30, fontWeight: "800", marginTop: 4 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 22 },
  group: { marginBottom: 19 },
  groupTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 9,
    marginLeft: 3,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 13,
  },
  menuItem: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  itemCopy: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 14, fontWeight: "800" },
  itemDescription: { fontSize: 11, lineHeight: 16 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 54 },
});
