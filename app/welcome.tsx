import { useRef, useState } from "react";
import {
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors } from "@/theme/colors";
import { useThemePreference } from "@/context/theme-context";
import { GoogleConnectModal } from "@/components/auth/google-connect-modal";

const slides = [
  {
    eyebrow: "WELCOME TO BUDGETNEST",
    title: "A clearer view of your money.",
    description: "Bring your accounts, spending, and savings goals together in one calm, easy-to-understand space.",
    icon: "wallet-outline" as const,
    points: ["See your balances at a glance", "Understand your monthly cash flow"],
  },
  {
    eyebrow: "PLAN WITH CONFIDENCE",
    title: "Make every peso count.",
    description: "Build budgets, track recurring bills, manage loan obligations, and keep your savings goals moving.",
    icon: "chart-box-outline" as const,
    points: ["Create budgets that make sense", "Stay ahead of upcoming payments"],
  },
  {
    eyebrow: "PRIVATE BY DESIGN",
    title: "Your finances stay on your device.",
    description: "BudgetNest works without an account. Your records are stored locally, and Google is optional for cloud backup and restore.",
    icon: "shield-lock-outline" as const,
    points: ["No account needed to get started", "Connect Google only for backup features"],
  },
  {
    eyebrow: "OPTIONAL CLOUD CONNECTION",
    title: "Keep a backup with Google.",
    description: "Connect your Google account when you want to back up or restore your BudgetNest data. You can also skip this and start using the app right away.",
    icon: "cloud-check-outline" as const,
    points: ["Google Drive backup and restore", "You stay in control of the connection"],
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { mode } = useThemePreference();
  const palette = mode === "dark" ? colors.dark : colors.light;
  const [activeIndex, setActiveIndex] = useState(0);
  const [connectVisible, setConnectVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const lastSlide = activeIndex === slides.length - 1;

  const explore = () => router.replace("/(tabs)");

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(Math.max(0, Math.min(slides.length - 1, next)));
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={[styles.brandMark, { backgroundColor: palette.primary }]}>
            <MaterialCommunityIcons name="sprout" size={21} color="#FFFFFF" />
          </View>
          <Text style={[styles.brand, { color: palette.text }]}>BudgetNest</Text>
        </View>
        <Pressable onPress={explore} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.skipTop, { color: palette.textMuted }]}>Close</Text>
        </Pressable>
      </View>

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
          <View key={slide.eyebrow} style={[styles.slide, { width }]}>
            <View style={[styles.illustration, { backgroundColor: mode === "dark" ? "#3A2424" : "#FCE8E8" }]}>
              <View style={[styles.illustrationInner, { backgroundColor: palette.primary }]}>
                <MaterialCommunityIcons name={slide.icon} size={58} color="#FFFFFF" />
              </View>
              <View style={[styles.sparkle, { backgroundColor: palette.surface }]}>
                <MaterialCommunityIcons name={index === 3 ? "google" : "check"} size={18} color={palette.primary} />
              </View>
            </View>

            <Text style={[styles.eyebrow, { color: palette.primary }]}>{slide.eyebrow}</Text>
            <Text style={[styles.heading, { color: palette.text }]}>{slide.title}</Text>
            <Text style={[styles.description, { color: palette.textMuted }]}>{slide.description}</Text>

            <View style={styles.points}>
              {slide.points.map(point => (
                <View key={point} style={styles.point}>
                  <MaterialCommunityIcons name="check-circle" size={18} color={palette.success} />
                  <Text style={[styles.pointText, { color: palette.text }]}>{point}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((slide, index) => (
            <View key={slide.eyebrow} style={[styles.dot, { backgroundColor: index === activeIndex ? palette.primary : palette.border, width: index === activeIndex ? 22 : 7 }]} />
          ))}
        </View>

        {lastSlide ? (
          <>
            <Pressable onPress={() => setConnectVisible(true)} style={[styles.primaryButton, { backgroundColor: palette.primary }]}>
              <MaterialCommunityIcons name="google" size={19} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Connect with Google</Text>
            </Pressable>
            <Pressable onPress={explore} style={styles.secondaryAction}>
              <Text style={[styles.secondaryActionText, { color: palette.textMuted }]}>Continue without Google</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={() => scrollRef.current?.scrollTo({ x: width * (activeIndex + 1), animated: true })}
            style={[styles.primaryButton, { backgroundColor: palette.primary }]}
          >
            <Text style={styles.primaryButtonText}>Next</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
        )}
        <Text style={[styles.footerNote, { color: palette.textMuted }]}>Your money. Your pace. Your privacy.</Text>
      </View>

      <GoogleConnectModal
        visible={connectVisible}
        onClose={() => setConnectVisible(false)}
        onConnected={() => {
          setConnectVisible(false);
          router.replace("/(tabs)");
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { height: 58, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  brand: { fontSize: 17, fontWeight: "900", letterSpacing: -0.4 },
  skipTop: { fontSize: 13, fontWeight: "700" },
  slider: { flex: 1 },
  sliderContent: { alignItems: "stretch" },
  slide: { flex: 1, alignItems: "center", paddingHorizontal: 30, paddingTop: 22 },
  illustration: { width: 188, height: 188, borderRadius: 60, alignItems: "center", justifyContent: "center", marginBottom: 34 },
  illustrationInner: { width: 132, height: 132, borderRadius: 42, alignItems: "center", justifyContent: "center" },
  sparkle: { position: "absolute", right: 12, bottom: 15, width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", elevation: 3 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.4, textAlign: "center" },
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
});
