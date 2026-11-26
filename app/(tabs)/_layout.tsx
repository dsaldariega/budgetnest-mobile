import { Tabs } from "expo-router";
import { Text, useColorScheme } from "react-native";
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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: 64,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} dark={isDark} /> }} />
      <Tabs.Screen name="transactions" options={{ title: "Activity", tabBarLabel: ({ focused }) => <TabLabel label="Activity" focused={focused} dark={isDark} /> }} />
      <Tabs.Screen name="budgets" options={{ title: "Budgets", tabBarLabel: ({ focused }) => <TabLabel label="Budgets" focused={focused} dark={isDark} /> }} />
      <Tabs.Screen name="goals" options={{ title: "Goals", tabBarLabel: ({ focused }) => <TabLabel label="Goals" focused={focused} dark={isDark} /> }} />
      <Tabs.Screen name="loans" options={{ title: "Loans", tabBarLabel: ({ focused }) => <TabLabel label="Loans" focused={focused} dark={isDark} /> }} />
      <Tabs.Screen name="accounts" options={{ title: "Accounts", tabBarLabel: ({ focused }) => <TabLabel label="Accounts" focused={focused} dark={isDark} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarLabel: ({ focused }) => <TabLabel label="Settings" focused={focused} dark={isDark} /> }} />
    </Tabs>
  );
}
