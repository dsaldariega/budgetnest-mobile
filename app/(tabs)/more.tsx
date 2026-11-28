import { useAppTheme } from "@/theme/use-app-theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { BudgetNestBrand } from "@/components/ui/budgetnest-brand";

const MENU_GROUPS = [
  {
    title: "Planning & Commitments",
    items: [
      { label: "Goals", icon: "bullseye-arrow", route: "/(tabs)/goals" },
      { label: "Loans", icon: "bank-outline", route: "/loans" },
      { label: "Subscriptions", icon: "calendar-clock", route: "/subscriptions" },
      { label: "Recurring", icon: "repeat", route: "/recurring" },
    ],
  },
  {
    title: "Insights & History",
    items: [
      { label: "Reports", icon: "chart-box-outline", route: "/reports" },
      { label: "Activity Log", icon: "history", route: "/activity-log" },
    ],
  },
  {
    title: "App & Data",
    items: [
      { label: "Settings", icon: "cog-outline", route: "/settings" },
      { label: "About & Help", icon: "help-circle-outline", route: "/about" },
      { label: "Privacy", icon: "shield-lock-outline", route: "/privacy" },
    ],
  },
] as const;

export default function MoreScreen() {
  const router = useRouter();
  const { isDark: dark, palette } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const useColumns = width >= 720 || width > height;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.background }]}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={[styles.content, useColumns && styles.contentWide]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <BudgetNestBrand color={palette.text} size={38} />
          <Text style={[styles.title, { color: palette.text }]}>More</Text>

        </View>

        {MENU_GROUPS.map((group) => (
          <View key={group.title} style={[styles.group, useColumns && styles.groupWide]}>
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
                        { backgroundColor: palette.primarySoft },
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
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 },
  contentWide: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", maxWidth: 1160, width: "100%", alignSelf: "center" },
  intro: { width: "100%" },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  title: { fontSize: 28, fontWeight: "800", marginTop: 4, marginBottom: 16 },
  group: { marginBottom: 14 },
  groupWide: { width: "48%" },
  groupTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 7,
    marginLeft: 3,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
  },
  menuItem: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemCopy: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 13, fontWeight: "800" },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 46 },
});