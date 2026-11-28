import { useRef, useState, type ComponentRef } from "react";
import {
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ActivityIndicator,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { useThemePreference } from "@/context/theme-context";
import { useGoogleAuth } from "@/context/google-auth-context";
import { BudgetNestBrand } from "@/components/ui/budgetnest-brand";

const slides = [
  {
    title: "Keep track of your money in one place.",
    description: "Log daily expenses fast, check your balances, and see where your spending goes each month.",
    icon: "wallet-outline" as const,
  },
  {
    title: "Track at your own pace, anytime.",
    description: "Record spending in seconds, set budgets that fit your routine, and use the app anytime—even without internet or an account. Your records stay on your phone.",
    icon: "chart-box-outline" as const,
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { mode } = useThemePreference();
  const palette = mode === "dark" ? colors.dark : colors.light;
  const { signIn, signingIn, error: googleError } = useGoogleAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [connectError, setConnectError] = useState("");
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const showGoogleStep = activeIndex === slides.length;
  const lastSlide = activeIndex === slides.length - 1;

  const explore = () => router.replace("/(tabs)");

  const connectGoogle = async () => {
    setConnectError("");
    try {
      await signIn();
      router.replace("/(tabs)");
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : googleError || "Unable to connect with Google.");
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(Math.max(0, Math.min(slides.length - 1, next)));
  };

  const goToGoogleStep = () => {
    setActiveIndex(slides.length);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={styles.topBar}>
        <BudgetNestBrand color={palette.text} size={30} />
        <Pressable onPress={explore} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.skipTop, { color: palette.textMuted }]}>Skip</Text>
        </Pressable>
      </View>

      {!showGoogleStep ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={styles.slider}
          contentContainerStyle={styles.sliderContent}
        >
          {slides.map((slide, index) => (
            <View key={slide.title} style={[styles.slide, { width }]}>
              <View style={[styles.illustration, { backgroundColor: mode === "dark" ? "#3A2424" : "#FCE8E8" }]}>
                <View style={[styles.illustrationInner, { backgroundColor: palette.primary }]}>
                  <MaterialCommunityIcons name={slide.icon} size={58} color="#FFFFFF" />
                </View>
              </View>

              <Text style={[styles.heading, { color: palette.text }]}>{slide.title}</Text>
              <Text style={[styles.description, { color: palette.textMuted }]}>{slide.description}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.googleStep}>
          <View style={[styles.illustration, { backgroundColor: mode === "dark" ? "#3A2424" : "#FCE8E8" }]}>
            <View style={[styles.illustrationInner, { backgroundColor: palette.primary }]}>
              <MaterialCommunityIcons name="google-drive" size={58} color="#FFFFFF" />
            </View>
          </View>

          <Text style={[styles.heading, { color: palette.text }]}>Want to back up your data with Google?</Text>
          <Text style={[styles.description, { color: palette.textMuted }]}>
            Optional: connect your Google account if you want to back up and restore your records on Google Drive, or jump straight in.
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        {!showGoogleStep ? (
          <View style={styles.pagination}>
            {[0, 1].map(index => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === activeIndex ? palette.primary : palette.border,
                    width: index === activeIndex ? 22 : 7,
                  },
                ]}
              />
            ))}
          </View>
        ) : null}

        {showGoogleStep ? (
          <>
            <Pressable
              onPress={explore}
              style={[styles.primaryButton, { backgroundColor: palette.primary }]}
            >
              <Text style={styles.primaryButtonText}>Start Without Google</Text>
            </Pressable>

            <Pressable
              disabled={signingIn}
              onPress={() => void connectGoogle()}
              style={styles.secondaryAction}
            >
              {signingIn ? (
                <ActivityIndicator color={palette.primary} />
              ) : (
                <MaterialCommunityIcons name="google" size={17} color={palette.primary} />
              )}
              <Text style={[styles.secondaryActionText, { color: palette.primary }]}>
                {signingIn ? "Connecting…" : "Connect with Google"}
              </Text>
            </Pressable>

            {connectError ? <Text style={[styles.connectError, { color: palette.primary }]}>{connectError}</Text> : null}
          </>
        ) : (
          <Pressable
            onPress={() => {
              if (lastSlide) {
                goToGoogleStep();
              } else {
                scrollRef.current?.scrollTo({ x: width, animated: true });
              }
            }}
            style={[styles.primaryButton, { backgroundColor: palette.primary }]}
          >
            <Text style={styles.primaryButtonText}>Next</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
        )}
        <Text style={[styles.footerNote, { color: palette.textMuted }]}>Your money. Your pace. Your privacy.</Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { height: 58, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skipTop: { fontSize: 13, fontWeight: "700" },
  slider: { flex: 1 },
  sliderContent: { alignItems: "stretch" },
  slide: { flex: 1, alignItems: "center", paddingHorizontal: 30, paddingTop: 22 },
  googleStep: { flex: 1, alignItems: "center", paddingHorizontal: 30, paddingTop: 22, justifyContent: "center" },
  illustration: { width: 188, height: 188, borderRadius: 60, alignItems: "center", justifyContent: "center", marginBottom: 34 },
  illustrationInner: { width: 132, height: 132, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  sparkle: { position: "absolute", right: 12, bottom: 15, width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", elevation: 3 },
  heading: { fontSize: 29, lineHeight: 36, fontWeight: "900", letterSpacing: -0.8, textAlign: "center", marginTop: 12, maxWidth: 340 },
  description: { fontSize: 14, lineHeight: 22, textAlign: "center", marginTop: 12, maxWidth: 340 },
  points: { alignSelf: "stretch", marginTop: 22, gap: 12, maxWidth: 330 },
  point: { flexDirection: "row", alignItems: "center", gap: 10 },
  pointText: { fontSize: 13, fontWeight: "600", flex: 1 },
  footer: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 16, gap: 10 },
  pagination: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, marginBottom: 8 },
  dot: { height: 7, borderRadius: 5 },
  primaryButton: { minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  secondaryAction: { minHeight: 36, alignItems: "center", justifyContent: "center" },
  secondaryActionText: { fontSize: 13, fontWeight: "700" },
  footerNote: { fontSize: 10, textAlign: "center", marginTop: 1 },
  connectError: { fontSize: 11, lineHeight: 16, textAlign: "center" },
});
