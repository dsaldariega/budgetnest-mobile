import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenBackButton } from "@/components/ui/screen-back-button";
import { colors } from "@/theme/colors";

const SECTIONS = [
  {
    icon: "database-outline",
    title: "Where your information is stored",
    paragraphs: [
      "BudgetNest stores your accounts, transactions, budgets, savings goals, loans, repayments, subscriptions, recurring schedules, activity history, and preferences in a local SQLite database on this device.",
      "Normal use does not require an account or cloud connection. Your financial records are not automatically synchronized to a server.",
    ],
  },
  {
    icon: "cloud-outline",
    title: "Optional Google Drive backup",
    paragraphs: [
      "If you choose to connect a Google account, BudgetNest can save a complete backup to its private Google Drive app-data area. The backup action is manual; connecting Google does not automatically upload your records.",
      "Restoring a backup replaces the current local records after you review and confirm the restore. Backup JSON files are not encrypted by BudgetNest and can be read by anyone who obtains the file. Keep them in a trusted location and avoid sharing them publicly.",
    ],
  },
  {
    icon: "file-delimited-outline",
    title: "Transaction CSV files",
    paragraphs: [
      "CSV export creates a file containing the income and expense transactions that match your selected date range and filters. Transfers are excluded so that their paired records remain linked inside BudgetNest.",
      "CSV import reads a file you select, matches an active account by name and currency, creates missing categories, and skips duplicate transactions. Exported CSV files are plain text; BudgetNest neutralizes spreadsheet formula markers in exported text fields, but files you share or save outside BudgetNest are subject to the privacy and security of the destination you choose.",
    ],
  },
  {
    icon: "bank-outline",
    title: "No bank connections",
    paragraphs: [
      "BudgetNest does not connect to your bank or e-wallet, fetch balances from financial institutions, initiate payments, or require your bank password, card PIN, or banking credentials.",
      "Only enter information needed to describe your own financial records. Do not put passwords, PINs, or other banking credentials in transaction descriptions or notes.",
    ],
  },
  {
    icon: "shield-lock-outline",
    title: "Device security and data retention",
    paragraphs: [
      "The local database is stored in the app's private device storage. BudgetNest does not currently add a separate database-encryption layer, so protect your device with its screen lock and keep your operating system up to date.",
      "Clearing app storage or uninstalling the app can remove the local database. Device-level backup behavior depends on your operating system settings. Export or back up your information before removing the app or moving to another device.",
    ],
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const dark = useColorScheme() === "dark";
  const palette = dark ? colors.dark : colors.light;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ScreenBackButton backgroundColor={palette.surface} borderColor={palette.border} color={palette.text} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: palette.primary }]}>YOUR DATA</Text>
            <Text style={[styles.title, { color: palette.text }]}>Privacy policy</Text>
          </View>
        </View>

        <View style={[styles.notice, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <MaterialCommunityIcons name="information-outline" size={20} color={palette.primary} />
          <Text style={[styles.noticeText, { color: palette.textMuted }]}>
            Last reviewed November 26, 2026. This page explains the current mobile app behavior in plain language; it is product information, not legal advice.
          </Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.icon, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}>
                <MaterialCommunityIcons name={section.icon as never} size={21} color={palette.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{section.title}</Text>
            </View>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={[styles.paragraph, { color: palette.textMuted }]}>{paragraph}</Text>
            ))}
          </View>
        ))}

        <Pressable onPress={() => router.push("/about")} style={[styles.aboutLink, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <MaterialCommunityIcons name="help-circle-outline" size={20} color={palette.primary} />
          <Text style={[styles.aboutLinkText, { color: palette.text }]}>Back to About & Help</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={palette.textMuted} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 19, paddingBottom: 38, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 5 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  title: { fontSize: 25, fontWeight: "900", marginTop: 2 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 17 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 11 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  icon: { width: 41, height: 41, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: "900" },
  paragraph: { fontSize: 11, lineHeight: 18 },
  aboutLink: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  aboutLinkText: { flex: 1, fontSize: 12, fontWeight: "800" },
});
