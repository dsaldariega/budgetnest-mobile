import { Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type ScreenBackButtonProps = {
  backgroundColor: string;
  borderColor: string;
  color: string;
};

export function ScreenBackButton({
  backgroundColor,
  borderColor,
  color,
}: ScreenBackButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={() => router.back()}
      hitSlop={8}
      style={[styles.button, { backgroundColor, borderColor }]}
    >
      <MaterialCommunityIcons name="arrow-left" size={21} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
