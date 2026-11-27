import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { DatabaseProvider } from "@/database/provider";
import { GoogleAuthProvider } from "@/context/google-auth-context";
import { ThemePreferenceProvider } from "@/context/theme-context";
import { colors } from "@/theme/colors";

const slideScreenOptions = {
  presentation: "card" as const,
  animation: "slide_from_right" as const,
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <DatabaseProvider>
      <ThemePreferenceProvider>
        <GoogleAuthProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: isDark ? colors.dark.background : colors.light.background,
            },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="loans" options={slideScreenOptions} />
          <Stack.Screen name="subscriptions" options={slideScreenOptions} />
          <Stack.Screen name="settings" options={slideScreenOptions} />
          <Stack.Screen name="recurring" options={slideScreenOptions} />
          <Stack.Screen name="reports" options={slideScreenOptions} />
          <Stack.Screen name="activity-log" options={slideScreenOptions} />
          <Stack.Screen name="about" options={slideScreenOptions} />
          <Stack.Screen name="privacy" options={slideScreenOptions} />
        </Stack>
        </GoogleAuthProvider>
      </ThemePreferenceProvider>
    </DatabaseProvider>
  );
}
