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
  const { width, height } = useWindowDimensions();
  const wideLayout = width >= 720 || width > height;
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
                <View style={s.monthMetric}><Text style={s.monthMetricLabel}>In</Text><Text style={s.monthMetricValue}>{money(item.incomeMinor, item.currencyCode)}</Text></View>
                <View style={s.monthMetric}><Text style={s.monthMetricLabel}>Out</Text><Text style={s.monthMetricValue}>{money(item.expenseMinor, item.currencyCode)}</Text></View>
                <View style={s.monthMetric}><Text style={s.monthMetricLabel}>Net</Text><Text style={s.monthMetricValue}>{money(item.incomeMinor - item.expenseMinor, item.currencyCode)}</Text></View>
              </View>
            ))}
          </View>
        </View>

        <Pressable onPress={() => router.push("/(tabs)/transactions?quick=expense")} style={[s.logExpenseButton, { backgroundColor: p.primary }]}>
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
          <Text style={s.logExpenseText}>Log Expense</Text>
        </Pressable>

        <SectionHeading title="Budgets" action="See all" onPress={() => router.push("/(tabs)/budgets")} palette={p} />
        <SectionHeading title="Budgets" action="See all" onPress={() => router.push("/(tabs)/budgets")} palette={p} />
        {data.budgets.length ? data.budgets.map(item => (
          <View key={item.id} style={[s.listCard, { backgroundColor: p.surface, borderColor: p.border }]}>
            <View style={s.listTop}>
              <View style={[s.smallIcon, { backgroundColor: dark ? "#263B35" : "#E8F5E9" }]}><MaterialCommunityIcons name="chart-donut" size={19} color={p.success} /></View>
              <View style={s.listMain}><Text style={[s.itemTitle, { color: p.text }]}>{item.categoryName}</Text><Text style={[s.itemSub, { color: p.textMuted }]}>{item.accountName} · {item.period}</Text></View>
              <Text style={[s.itemAmount, { color: item.spentMinor > item.amountMinor ? p.expense : p.text }]}>{money(item.spentMinor, item.currencyCode)}</Text>
            </View>
            <ProgressBar progress={item.progress} color={item.progress >= 1 ? p.expense : p.primary} track={p.border} />
            <Text style={[s.progressCaption, { color: p.textMuted }]}>{money(item.spentMinor, item.currencyCode)} of {money(item.amountMinor, item.currencyCode)}</Text>
          </View>
        )) : <EmptyState icon="chart-donut" title="No active budgets yet" message="Create a budget to set a spending limit and track progress." actionLabel="Create a budget" onAction={() => router.push("/(tabs)/budgets")} palette={p} dark={dark} />}

        <SectionHeading title="Savings goals" action="See all" onPress={() => router.push("/(tabs)/goals")} palette={p} />
        {data.goals.length ? data.goals.map(item => (
          <View key={item.id} style={[s.listCard, { backgroundColor: p.surface, borderColor: p.border }]}>
            <View style={s.listTop}>
              <View style={[s.smallIcon, { backgroundColor: dark ? "#263B35" : "#E8F5E9" }]}><MaterialCommunityIcons name="bullseye-arrow" size={19} color={p.success} /></View>
              <View style={s.listMain}><Text style={[s.itemTitle, { color: p.text }]}>{item.name}</Text><Text style={[s.itemSub, { color: p.textMuted }]}>{item.targetDate ? `Target ${shortDate(item.targetDate)}` : "No target date"}</Text></View>
              <Text style={[s.itemAmount, { color: p.text }]}>{Math.round(item.progress * 100)}%</Text>
            </View>
            <ProgressBar progress={item.progress} color={p.success} track={p.border} />
            <Text style={[s.progressCaption, { color: p.textMuted }]}>{money(item.currentAmountMinor, item.currencyCode)} of {money(item.targetAmountMinor, item.currencyCode)}</Text>
          </View>
        )) : <Text style={[s.emptyText, { color: p.textMuted }]}>No active savings goals to show.</Text>}

        <SectionHeading title="Upcoming bills" action="See all" onPress={() => router.push("/subscriptions")} palette={p} />
        {data.subscriptions.length ? data.subscriptions.map(item => {
          const overdue = item.nextBillingDate < today();
          return <View key={item.id} style={[s.compactCard, { backgroundColor: p.surface, borderColor: p.border }]}>
            <View style={[s.smallIcon, { backgroundColor: dark ? "#3C3323" : "#FFF3E0" }]}><MaterialCommunityIcons name="calendar-clock" size={19} color={p.warning} /></View>
            <View style={s.listMain}><Text style={[s.itemTitle, { color: p.text }]}>{item.name}</Text><Text style={[s.itemSub, { color: overdue ? p.expense : p.textMuted }]}>{overdue ? "Overdue" : "Due"} · {shortDate(item.nextBillingDate)}</Text></View>
            <Text style={[s.itemAmount, { color: p.text }]}>{money(item.amountMinor, item.currencyCode)}</Text>
          </View>;
        }) : <Text style={[s.emptyText, { color: p.textMuted }]}>No upcoming subscription bills.</Text>}

        <SectionHeading title="Loan obligations" action="See all" onPress={() => router.push("/loans")} palette={p} />
        {data.loans.length ? data.loans.map(item => (
          <View key={item.id} style={[s.compactCard, { backgroundColor: p.surface, borderColor: p.border }]}>
            <View style={[s.smallIcon, { backgroundColor: dark ? "#2B3443" : "#EAF0FA" }]}><MaterialCommunityIcons name="bank-outline" size={19} color={p.secondary} /></View>
            <View style={s.listMain}><Text style={[s.itemTitle, { color: p.text }]}>{item.name}</Text><Text style={[s.itemSub, { color: p.textMuted }]}>{item.status === "paused" ? "Paused" : `Due ${shortDate(item.dueDate)}`}</Text></View>
            <Text style={[s.itemAmount, { color: p.text }]}>{money(item.remainingMinor, item.currencyCode)}</Text>
          </View>
        )) : <Text style={[s.emptyText, { color: p.textMuted }]}>No active loan obligations.</Text>}

        <SectionHeading title="Recent activity" action="See all" onPress={() => router.push("/(tabs)/transactions")} palette={p} />
        {data.activity.length ? data.activity.map(item => (
          <View key={item.id} style={[s.compactCard, { backgroundColor: p.surface, borderColor: p.border }]}>
            <View style={[s.smallIcon, { backgroundColor: dark ? "#30303A" : "#F1F3F7" }]}><MaterialCommunityIcons name={item.kind === "income" ? "arrow-down-circle-outline" : item.kind === "expense" ? "arrow-up-circle-outline" : item.kind === "savings" ? "piggy-bank-outline" : "swap-horizontal"} size={19} color={item.kind === "income" ? p.income : item.kind === "expense" ? p.expense : p.secondary} /></View>
            <View style={s.listMain}><Text style={[s.itemTitle, { color: p.text }]} numberOfLines={1}>{item.title}</Text><Text style={[s.itemSub, { color: p.textMuted }]}>{item.subtitle} · {new Date(item.occurredAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</Text></View>
            <Text style={[s.itemAmount, { color: item.kind === "income" ? p.income : item.kind === "expense" ? p.expense : p.text }]}>{money(item.amountMinor, item.currencyCode)}</Text>
          </View>
        )) : <EmptyState icon="receipt-text-outline" title="No recent activity yet" message="Log your first expense to start building your financial history." actionLabel="Log Expense" onAction={() => router.push("/(tabs)/transactions?quick=expense")} palette={p} dark={dark} />}

        {error ? <Text style={[s.errorText, { color: p.expense }]}>{error}</Text> : null}
        {loading ? <Text style={[s.loadingText, { color: p.textMuted }]}>Refreshing your overview…</Text> : null}
        <Text style={[s.footerText, { color: p.textMuted }]}>Your financial data stays on this device.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 36 },
  contentWide: { width: "100%", maxWidth: 1160, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  brand: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  greeting: { fontSize: 27, fontWeight: "800", letterSpacing: -0.7, marginTop: 3 },
  dateText: { fontSize: 13, marginTop: 3 },
  headerButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  heroCard: { borderRadius: 22, padding: 20, marginBottom: 26 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  heroLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroEyebrow: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroMark: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  balanceLine: { marginBottom: 8 },
  currencyCode: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "700", marginBottom: 2 },
  heroAmount: { color: "#FFFFFF", fontSize: 27, fontWeight: "800", letterSpacing: -0.5 },
  heroFooter: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.22)", marginTop: 12, paddingTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroFootText: { color: "rgba(255,255,255,0.76)", fontSize: 12 },
  heroLink: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroLinkText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  monthSummary: { marginTop: 16, paddingTop: 15, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.22)" },
  monthSummaryTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", marginBottom: 10 },
  monthSummaryEmpty: { color: "rgba(255,255,255,0.72)", fontSize: 11 },
  monthSummaryRow: { flexDirection: "row", gap: 8 },
  monthMetric: { flex: 1 },
  monthMetricLabel: { color: "rgba(255,255,255,0.68)", fontSize: 10, fontWeight: "700" },
  monthMetricValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", marginTop: 3 },
  logExpenseButton: { minHeight: 52, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, marginBottom: 10 },
  logExpenseText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  actionText: { fontSize: 12, fontWeight: "700" },
  cashFlowCard: { borderWidth: 1, borderRadius: 17, padding: 16, marginBottom: 12 },
  currencyHeading: { fontSize: 13, fontWeight: "800", marginBottom: 14 },
  cashFlowRow: { flexDirection: "row", alignItems: "center" },
  cashFlowMetric: { flex: 1, gap: 7 },
  metricLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metricLabel: { fontSize: 12, fontWeight: "600" },
  metricValue: { fontSize: 17, fontWeight: "800" },
  metricDivider: { width: 1, height: 40, marginHorizontal: 12 },
  netRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, marginTop: 14, paddingTop: 12 },
  netLabel: { fontSize: 12, fontWeight: "600" },
  netValue: { fontSize: 14, fontWeight: "800" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  quickCard: { width: "48%", minHeight: 88, borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  quickCardWide: { width: "31.5%" },
  quickIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  quickLabel: { flex: 1, fontSize: 13, fontWeight: "700" },
  listCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  listTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  smallIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  listMain: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 13, fontWeight: "700" },
  itemSub: { fontSize: 11, marginTop: 4 },
  itemAmount: { fontSize: 12, fontWeight: "800" },
  progressTrack: { height: 7, borderRadius: 5, overflow: "hidden" },
  progressFill: { height: 7, borderRadius: 5 },
  progressCaption: { fontSize: 10, marginTop: -5 },
  compactCard: { borderWidth: 1, borderRadius: 15, padding: 12, marginBottom: 9, flexDirection: "row", alignItems: "center", gap: 10 },
  emptyCard: { borderWidth: 1, borderRadius: 15, padding: 16, marginBottom: 12 },
  emptyText: { fontSize: 12, paddingVertical: 8 },
  mutedText: { fontSize: 12, lineHeight: 18 },
  errorText: { fontSize: 12, marginTop: 14 },
  loadingText: { fontSize: 11, textAlign: "center", marginTop: 16 },
  footerText: { fontSize: 10, textAlign: "center", marginTop: 24 },
});
