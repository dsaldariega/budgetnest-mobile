import { Tabs } from "expo-router";
import { Text, useColorScheme, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";

function TabLabel({ label, focused, dark }: { label: string; focused: boolean; dark: boolean }) {
  return (
    <Text
      style={{
        color: focused
          ? dark ? colors.dark.primary : colors.light.primary
          : dark ? colors.dark.textMuted : colors.light.textMuted,
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
  const { width, height } = useWindowDimensions();
  // Keep the bottom bar on phones, including landscape. Use a side rail only
  // when the device has tablet-sized space on both dimensions.
  const useNavigationRail = Math.min(width, height) >= 600;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: useNavigationRail ? "left" : "bottom",
        tabBarVariant: useNavigationRail ? "material" : "uikit",
        tabBarLabelPosition: "below-icon",
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: useNavigationRail
          ? {
              width: 88,
              backgroundColor: palette.surface,
              borderRightColor: palette.border,
              borderTopWidth: 0,
              paddingTop: 12 + insets.top,
              paddingBottom: 12 + insets.bottom,
            }
          : {
              backgroundColor: palette.surface,
              borderTopColor: palette.border,
              height: 62 + insets.bottom,
              paddingTop: 6,
              paddingBottom: 6 + insets.bottom,
              paddingHorizontal: 2,
            },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
        tabBarItemStyle: useNavigationRail ? { minHeight: 66 } : undefined,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} dark={isDark} />,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home-outline" size={size} color={typeof color === "number" ? palette.textMuted : color ?? palette.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Accounts",
          tabBarLabel: ({ focused }) => <TabLabel label="Accounts" focused={focused} dark={isDark} />,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="wallet-outline" size={size} color={typeof color === "number" ? palette.textMuted : color ?? palette.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Activity",
          tabBarLabel: ({ focused }) => <TabLabel label="Activity" focused={focused} dark={isDark} />,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="receipt-text-outline" size={size} color={typeof color === "number" ? palette.textMuted : color ?? palette.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="goals"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarLabel: ({ focused }) => <TabLabel label="More" focused={focused} dark={isDark} />,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="menu" size={size} color={typeof color === "number" ? palette.textMuted : color ?? palette.textMuted} />
          ),
        }}
      />
    </Tabs>
  );
}
