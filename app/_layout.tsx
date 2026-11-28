import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { DatabaseProvider } from "@/database/provider";
import { GoogleAuthProvider } from "@/context/google-auth-context";
import { ThemePreferenceProvider } from "@/context/theme-context";
import { useAppTheme } from "@/theme/use-app-theme";

const slideScreenOptions = {
  presentation: "card" as const,
  animation: "slide_from_right" as const,
};

function RootNavigator() {
  const { mode, loading, palette } = useAppTheme();

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: palette.background }} />;
  }

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="budgets" options={slideScreenOptions} />
        <Stack.Screen name="goals" options={slideScreenOptions} />
        <Stack.Screen name="loans" options={slideScreenOptions} />
        <Stack.Screen name="subscriptions" options={slideScreenOptions} />
        <Stack.Screen name="settings" options={slideScreenOptions} />
        <Stack.Screen name="recurring" options={slideScreenOptions} />
        <Stack.Screen name="reports" options={slideScreenOptions} />
        <Stack.Screen name="activity-log" options={slideScreenOptions} />
        <Stack.Screen name="about" options={slideScreenOptions} />
        <Stack.Screen name="privacy" options={slideScreenOptions} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <ThemePreferenceProvider>
        <GoogleAuthProvider>
          <RootNavigator />
        </GoogleAuthProvider>
      </ThemePreferenceProvider>
    </DatabaseProvider>
  );
}