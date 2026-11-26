import { Tabs } from "expo-router";
import { Text, useColorScheme } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";

function TabLabel({ label, focused, dark }: { label: string; focused: boolean; dark: boolean }) {
  return (
    <Text
      style={{
        color: focused ? (dark ? colors.dark.primary : colors.light.primary) : (dark ? colors.dark.textMuted : colors.light.textMuted),
        fontSize: 11,
        fontWeight: focused ? "700" : "500",
      }}
    >
      {label}
    </Text>
  );
}

export default function TabLayout() {
  const isDark = useColorScheme() === "dark";
  const palette = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: 64 + insets.bottom,
          paddingTop: 7,
          paddingBottom: 7 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} dark={isDark} />, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="transactions" options={{ title: "Activity", tabBarLabel: ({ focused }) => <TabLabel label="Activity" focused={focused} dark={isDark} />, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="receipt-text-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="budgets" options={{ title: "Budgets", tabBarLabel: ({ focused }) => <TabLabel label="Budgets" focused={focused} dark={isDark} />, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chart-donut" size={size} color={color} /> }} />
      <Tabs.Screen name="goals" options={{ title: "Goals", tabBarLabel: ({ focused }) => <TabLabel label="Goals" focused={focused} dark={isDark} />, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="bullseye-arrow" size={size} color={color} /> }} />
      <Tabs.Screen name="loans" options={{ title: "Loans", tabBarLabel: ({ focused }) => <TabLabel label="Loans" focused={focused} dark={isDark} />, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="bank-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="subscriptions" options={{ title: "Subscriptions", tabBarLabel: ({ focused }) => <TabLabel label="Subs" focused={focused} dark={isDark} />, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="calendar-clock" size={size} color={color} /> }} />
      <Tabs.Screen name="accounts" options={{ title: "Accounts", tabBarLabel: ({ focused }) => <TabLabel label="Accounts" focused={focused} dark={isDark} />, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="wallet-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarLabel: ({ focused }) => <TabLabel label="Settings" focused={focused} dark={isDark} />, tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
