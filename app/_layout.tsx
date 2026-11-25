import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { DatabaseProvider } from "@/database/provider";
import { colors } from "@/theme/colors";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <DatabaseProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: isDark ? colors.dark.background : colors.light.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </DatabaseProvider>
  );
}
