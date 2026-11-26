import { Image, StyleSheet, Text, View } from "react-native";

const logo = require("../../../assets/budgetnest-logo.png");

export function BudgetNestBrand({
  color = "#1F2937",
  size = 36,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <View style={styles.container}>
      <Image
        source={logo}
        accessibilityLabel="BudgetNest logo"
        resizeMode="contain"
        style={{ width: size, aspectRatio: 1, flexShrink: 0 }}
      />
      <Text style={[styles.wordmark, { color, fontSize: size * 0.42 }]}>BudgetNest</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 10 },
  wordmark: { fontWeight: "900", letterSpacing: -0.35 },
});
