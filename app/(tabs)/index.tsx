import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { todayLocalDate } from "@/domain/dates";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createAccountRepository, type AccountWithBalance } from "@/database/repositories/account-repository";
import { createBudgetRepository, type BudgetListItem } from "@/database/repositories/budget-repository";
import { createHistoryRepository, type HistoryItem } from "@/database/repositories/history-repository";
import { colors } from "@/theme/colors";
import { EmptyState } from "@/components/EmptyState";

type CurrencySummary = { currencyCode: string; balanceMinor: number; incomeMinor: number; expenseMinor: number };
type DashboardData = {
  accounts: AccountWithBalance[];
  currencies: CurrencySummary[];
  budgets: BudgetListItem[];
  activity: HistoryItem[];
};

const today = todayLocalDate;
const currentMonth = () => today().slice(0, 7);
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-PH", {
  style: "currency", currency, maximumFractionDigits: 2,
}).format(minor / 100);
const shortDate = (value: string) => new Date(value + "T00:00:00").toLocaleDateString("en-PH", {
  month: "short", day: "numeric",
});

function SectionHeading({ title, action, onPress, palette }: {
  title: string; action?: string; onPress?: () => void; palette: typeof colors.light;
}) {
  return (
    <View style={s.sectionHeading}>
      <Text style={[s.sectionTitle, { color: palette.text }]}>{title}</Text>
      {action && onPress ? <Pressable onPress={onPress} hitSlop={8}><Text style={[s.actionText, { color: palette.primary }]}>{action}</Text></Pressable> : null}
    </View>
  );
}

function ProgressBar({ progress, color, track }: { progress: number; color: string; track: string }) {
  return <View style={[s.progressTrack, { backgroundColor: track }]}><View style={[s.progressFill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%`, backgroundColor: color }]} /></View>;
}

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const dark = useColorScheme() === "dark";
  const p = dark ? colors.dark : colors.light;
  const [data, setData] = useState<DashboardData>({
    accounts: [], currencies: [], budgets: [], activity: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const date = today();
      const month = currentMonth();
      const [accounts, budgets, goals, subscriptions, loans, activity, monthlyRows] = await Promise.all([
        createAccountRepository(db).list(),
        createBudgetRepository(db).list(date),
        createHistoryRepository(db).list({ limit: 5 }),
        db.getAllAsync<{ currency_code: string; income_minor: number; expense_minor: number }>(
          "SELECT a.currency_code, " +
          "COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount_minor ELSE 0 END), 0) AS income_minor, " +
          "COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount_minor ELSE 0 END), 0) AS expense_minor " +
          "FROM transactions t JOIN accounts a ON a.id = t.account_id " +
          "WHERE t.deleted_at IS NULL AND t.type IN ('income', 'expense') AND substr(t.occurred_at, 1, 7) = ? " +
          "GROUP BY a.currency_code ORDER BY a.currency_code",
          month,
        ),
      ]);

      const currencyCodes = new Set([...accounts.map(a => a.currencyCode), ...monthlyRows.map(row => row.currency_code)]);
      const currencies = [...currencyCodes].sort().map(currencyCode => {
        const monthly = monthlyRows.find(row => row.currency_code === currencyCode);
        return {
          currencyCode,
          balanceMinor: accounts.filter(account => account.currencyCode === currencyCode).reduce((sum, account) => sum + account.balanceMinor, 0),
          incomeMinor: monthly?.income_minor ?? 0,
          expenseMinor: monthly?.expense_minor ?? 0,
        };
      });

      setData({
        accounts,
        currencies,
        budgets: budgets.filter(item => item.startDate <= date && (!item.endDate || item.endDate >= date)).slice(0, 3),
        activity,
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load your financial overview.");
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const monthLabel = useMemo(() => new Date().toLocaleDateString("en-PH", { month: "long", year: "numeric" }), []);
  const totalAccounts = data.accounts.length;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: p.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={[s.content, wideLayout && s.contentWide]} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View>
            <Text style={[s.brand, { color: p.primary }]}>BudgetNest</Text>
            <Text style={[s.greeting, { color: p.text }]}>Your overview</Text>
            <Text style={[s.dateText, { color: p.textMuted }]}>{monthLabel}</Text>
          </View>
          <Pressable onPress={() => router.push("/settings")} style={[s.headerButton, { backgroundColor: p.surface, borderColor: p.border }]}>
            <MaterialCommunityIcons name="cog-outline" size={22} color={p.text} />
          </Pressable>
        </View>

        <View style={[s.heroCard, { backgroundColor: dark ? "#352020" : "#B71C1C" }]}>
          <View style={s.heroTop}>
            <View style={s.heroLabelRow}>
              <MaterialCommunityIcons name="wallet-outline" size={17} color="#FFFFFF" />
              <Text style={s.heroEyebrow}>TOTAL BALANCE</Text>
            </View>
            <View style={s.heroMark}><MaterialCommunityIcons name="sprout" size={22} color="#FFFFFF" /></View>
          </View>
          {loading ? <Text style={s.heroAmount}>Loading…</Text> : data.currencies.length === 0
            ? <Text style={s.heroAmount}>No accounts yet</Text>
            : data.currencies.map(item => (
              <View key={item.currencyCode} style={s.balanceLine}>
                <Text style={s.currencyCode}>{item.currencyCode}</Text>
                <Text style={s.heroAmount}>{money(item.balanceMinor, item.currencyCode)}</Text>
              </View>
            ))}
          <View style={s.heroFooter}>
            <Text style={s.heroFootText}>{totalAccounts} active {totalAccounts === 1 ? "account" : "accounts"}</Text>
            <Pressable onPress={() => router.push("/accounts")} style={s.heroLink}>
              <Text style={s.heroLinkText}>View accounts</Text>
              <MaterialCommunityIcons name="arrow-right" size={15} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={s.monthSummary}>
            <Text style={s.monthSummaryTitle}>This month</Text>
            {data.currencies.length === 0 ? (
              <Text style={s.monthSummaryEmpty}>Add an account to start tracking your cash flow.</Text>
            ) : data.currencies.map(item => (
              <View key={item.currencyCode} style={s.monthSummaryRow}>
                <View style={s.monthMetric}>
                  <Text style={s.monthMetricLabel}>In</Text>
                  <Text style={s.monthMetricValue}>{money(item.incomeMinor, item.currencyCode)}</Text>
                </View>
                <View style={s.monthMetric}>
                  <Text style={s.monthMetricLabel}>Out</Text>
                  <Text style={s.monthMetricValue}>{money(item.expenseMinor, item.currencyCode)}</Text>
                </View>
                <View style={s.monthMetric}>
                  <Text style={s.monthMetricLabel}>Net</Text>
                  <Text style={s.monthMetricValue}>{money(item.incomeMinor - item.expenseMinor, item.currencyCode)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <Pressable onPress={() => router.push("/(tabs)/transactions")} style={[s.logExpenseButton, { backgroundColor: p.primary }]}>
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
          <Text style={s.logExpenseText}>Log Expense</Text>
        </Pressable>

        <SectionHeading title="Budgets" action="See all" onPress={() => router.push("/(tabs)/budgets")} palette={p} />

        <SectionHeading title="Budgets" action="See all" onPress={() => router.push("/(tabs)/budgets")} palette={p} />
