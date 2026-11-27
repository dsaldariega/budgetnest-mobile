import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BudgetNestBrand } from "@/components/ui/budgetnest-brand";
import { ScreenBackButton } from "@/components/ui/screen-back-button";
import { colors } from "@/theme/colors";

const FEATURES = [
  { icon: "wallet-outline", title: "Accounts and transactions", detail: "Track cash, bank accounts, e-wallets, income, expenses, and transfers in one place." },
  { icon: "chart-donut", title: "Budgets and savings goals", detail: "Set spending limits, monitor progress, and keep your savings targets visible." },
  { icon: "bank-outline", title: "Loans and commitments", detail: "Keep loan balances, repayments, subscriptions, and recurring schedules organized." },
  { icon: "chart-box-outline", title: "Reports and insights", detail: "Review cash flow, spending categories, and monthly trends across your currencies." },
  { icon: "file-delimited-outline", title: "Your data, your copy", detail: "Export filtered transactions to CSV, import supported CSV files, and make optional Google Drive backups." },
];

const FAQS = [
  {
    question: "Do I need to connect my bank or e-wallet?",
    answer: "No. BudgetNest does not connect to financial institutions or fetch balances automatically. You enter your starting balances and record transactions yourself.",
  },
  {
    question: "How is an account balance calculated?",
    answer: "The balance starts with the opening balance, adds income and incoming transfers, then subtracts expenses and outgoing transfers. Transfers are not counted as income or expenses.",
  },
  {
    question: "Can I use different currencies?",
    answer: "Yes. Each account keeps its own currency. BudgetNest keeps totals for different currencies separate rather than adding them together without conversion.",
  },
  {
    question: "Do loan, subscription, or savings records change an account balance?",
    answer: "No. Those records track progress and payment history separately. To reflect money that actually moved, also record the matching income, expense, or transfer transaction.",
  },
  {
    question: "Can I import an Excel spreadsheet?",
    answer: "Save the spreadsheet as CSV using the BudgetNest template. Import supports income and expense rows, requires a matching active account and currency, creates missing categories, and skips duplicates. Transfers should be recorded in BudgetNest so both sides remain linked.",
  },
  {
    question: "How should I back up my information?",
    answer: "Open Settings to export filtered transactions as CSV or, if you choose to connect Google, save a complete local-data backup to your Google Drive app data area.",
  },
];

export default function AboutScreen() {
  const router = useRouter();
  const dark = useColorScheme() === "dark";
  const palette = dark ? colors.dark : colors.light;
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ScreenBackButton backgroundColor={palette.surface} borderColor={palette.border} color={palette.text} />
          <View style={{ flex: 1 }}><BudgetNestBrand color={palette.text} size={30} /><Text style={[styles.title, { color: palette.text }]}>About & Help</Text></View>
        </View>

        <View style={[styles.hero, { backgroundColor: dark ? "#57242C" : "#D32F2F" }]}>
          <Text style={styles.heroTitle}>Your money, with a little more clarity.</Text>
          <Text style={styles.heroText}>A personal finance workspace for accounts, spending, budgets, savings, and recurring commitments.</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>What you can do</Text>
        {FEATURES.map((feature) => (
          <View key={feature.title} style={[styles.feature, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.featureIcon, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}>
              <MaterialCommunityIcons name={feature.icon as never} size={21} color={palette.primary} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.featureTitle, { color: palette.text }]}>{feature.title}</Text>
              <Text style={[styles.featureText, { color: palette.textMuted }]}>{feature.detail}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 8 }]}>Getting started</Text>
        <View style={[styles.steps, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          {[
            ["01", "Create your accounts", "Add the cash, bank, or e-wallet accounts you want to track."],
            ["02", "Record what happens", "Add income and expenses, and use transfers when moving money between accounts."],
            ["03", "Set your plans", "Create budgets and savings goals, then add loans or recurring commitments when needed."],
            ["04", "Review and adjust", "Use your dashboard and reports to understand your financial picture."],
          ].map(([number, title, detail]) => (
            <View key={number} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}><Text style={[styles.stepNumberText, { color: palette.primary }]}>{number}</Text></View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.featureTitle, { color: palette.text }]}>{title}</Text>
                <Text style={[styles.featureText, { color: palette.textMuted }]}>{detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: palette.text, marginTop: 8 }]}>Frequently asked questions</Text>
        {FAQS.map((faq) => {
          const open = expanded === faq.question;
          return (
            <View key={faq.question} style={[styles.faq, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Pressable onPress={() => setExpanded(open ? null : faq.question)} style={styles.faqQuestion}>
                <Text style={[styles.featureTitle, { color: palette.text, flex: 1 }]}>{faq.question}</Text>
                <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={21} color={palette.textMuted} />
              </Pressable>
              {open ? <Text style={[styles.featureText, { color: palette.textMuted, marginTop: 10 }]}>{faq.answer}</Text> : null}
            </View>
          );
        })}

        <Pressable onPress={() => router.push("/privacy")} style={[styles.privacyLink, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <MaterialCommunityIcons name="shield-lock-outline" size={21} color={palette.primary} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.featureTitle, { color: palette.text }]}>Privacy policy</Text>
            <Text style={[styles.featureText, { color: palette.textMuted }]}>Learn what stays on this device and how optional backups work.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={21} color={palette.textMuted} />
        </Pressable>
        <Text style={[styles.footer, { color: palette.textMuted }]}>BudgetNest · Personal finance, made a little clearer.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 19, paddingBottom: 38, gap: 11 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 5 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  title: { fontSize: 25, fontWeight: "900", marginTop: 2 },
  hero: { borderRadius: 20, padding: 20, gap: 12, marginBottom: 6 },
  heroTitle: { color: "#fff", fontSize: 25, lineHeight: 31, fontWeight: "900", letterSpacing: -0.6 },
  heroText: { color: "rgba(255,255,255,0.88)", fontSize: 12, lineHeight: 19 },
  sectionTitle: { fontSize: 16, fontWeight: "900", marginTop: 8, marginBottom: 2 },
  feature: { borderWidth: 1, borderRadius: 15, padding: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  featureIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontSize: 12, fontWeight: "800", lineHeight: 17 },
  featureText: { fontSize: 11, lineHeight: 17 },
  steps: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 15 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  stepNumber: { width: 31, height: 31, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stepNumberText: { fontSize: 10, fontWeight: "900" },
  faq: { borderWidth: 1, borderRadius: 14, padding: 14 },
  faqQuestion: { flexDirection: "row", alignItems: "center", gap: 10 },
  privacyLink: { borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: "row", alignItems: "center", gap: 11, marginTop: 7 },
  footer: { textAlign: "center", fontSize: 10, marginTop: 12 },
});
