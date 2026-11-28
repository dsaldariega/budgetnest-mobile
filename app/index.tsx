import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useGoogleAuth } from "@/context/google-auth-context";
import { useAppTheme } from "@/theme/use-app-theme";

export default function EntryRoute() {
  const { user, loading } = useGoogleAuth();
  const { palette } = useAppTheme();

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)" : "/welcome"} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
