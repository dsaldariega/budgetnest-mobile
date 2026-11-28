import { useAppTheme } from "@/theme/use-app-theme";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { todayLocalDate } from "@/domain/dates";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createAccountRepository, type AccountWithBalance } from "@/database/repositories/account-repository";
import { createBudgetRepository, type BudgetListItem } from "@/database/repositories/budget-repository";
import { createHistoryRepository, type HistoryItem } from "@/database/repositories/history-repository";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/ui/section-header";

type CurrencySummary = { currencyCode: string; balanceMinor: number; incomeMinor: number; expenseMinor: number };
type DashboardData = { accounts: AccountWithBalance[]; currencies: CurrencySummary[]; budgets: BudgetListItem[]; activity: HistoryItem[] };

const today = todayLocalDate;
const currentMonth = () => today().slice(0, 7);
const monthDate = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1);
const shiftMonth = (month: string, offset: number) => {
  const date = monthDate(month);
  date.setMonth(date.getMonth() + offset);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
};
const monthBounds = (month: string) => {
  const next = shiftMonth(month, 1);
  const lastDay = new Date(Number(next.slice(0, 4)), Number(next.slice(5, 7)) - 1, 0).getDate();
  return { start: month + "-01", end: month + "-" + String(lastDay).padStart(2, "0") + "T23:59:59.999" };
};
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100);
const monthTitle = (month: string) => monthDate(month).toLocaleDateString("en-PH", { month: "long", year: "numeric" });
const shortDate = (value: string) => new Date(value.slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" });

function ProgressBar({ progress, color, track }: { progress: number; color: string; track: string }) {
  return <View style={[s.progressTrack, { backgroundColor: track }]}><View style={[s.progressFill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%`, backgroundColor: color }]} /></View>;
}

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { isDark: dark, palette: p } = useAppTheme();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [data, setData] = useState<DashboardData>({ accounts: [], currencies: [], budgets: [], activity: [] });
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const date = today();
      const bounds = monthBounds(selectedMonth);
      const [accounts, budgets, activity, monthlyRows] = await Promise.all([
        createAccountRepository(db).list(),
        createBudgetRepository(db).list(date),
        createHistoryRepository(db).list({ limit: 200, fromDate: bounds.start, toDate: bounds.end }),
        db.getAllAsync<{ currency_code: string; income_minor: number; expense_minor: number }>(
          "SELECT a.currency_code, " +
          "COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount_minor ELSE 0 END), 0) AS income_minor, " +
          "COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount_minor ELSE 0 END), 0) AS expense_minor " +
          "FROM transactions t JOIN accounts a ON a.id = t.account_id " +
          "WHERE t.deleted_at IS NULL AND t.type IN ('income', 'expense') AND substr(t.occurred_at, 1, 7) = ? " +
          "GROUP BY a.currency_code ORDER BY a.currency_code",
          selectedMonth,
        ),
      ]);

      const safeAccounts = Array.isArray(accounts) ? accounts : [];
      const activeAccounts = safeAccounts.filter(account => !account.isArchived);
      const safeMonthlyRows = Array.isArray(monthlyRows) ? monthlyRows : [];
      const currencyCodes = new Set([...activeAccounts.map(a => a.currencyCode), ...safeMonthlyRows.map(row => row.currency_code)]);
      const currencies = [...currencyCodes].sort().map(currencyCode => {
        const monthly = safeMonthlyRows.find(row => row.currency_code === currencyCode);
        return {
          currencyCode,
          balanceMinor: activeAccounts.filter(account => account.currencyCode === currencyCode).reduce((sum, account) => sum + account.balanceMinor, 0),
          incomeMinor: monthly?.income_minor ?? 0,
          expenseMinor: monthly?.expense_minor ?? 0,
        };
      });
      const safeBudgets = (Array.isArray(budgets) ? budgets : [])
        .filter(item => item.startDate <= date && (!item.endDate || item.endDate >= date))
        .slice(0, 3);
      setData({
        accounts: safeAccounts,
        currencies,
        budgets: safeBudgets,
        activity: (Array.isArray(activity) ? activity : []).slice(0, 5),
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load your financial overview.");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [db, selectedMonth]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const activeAccounts = data.accounts.filter(account => !account.isArchived).length;
  const monthLabel = monthTitle(selectedMonth);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: p.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View>
            <Text style={[s.brand, { color: p.primaryText }]}>BUDGETNEST</Text>
            <Text style={[s.greeting, { color: p.text }]}>Your overview</Text>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/accounts")} style={[s.headerAction, { borderColor: p.border, backgroundColor: p.surface }]}
            accessibilityRole="button" accessibilityLabel="View accounts">
            <MaterialCommunityIcons name="wallet-outline" size={19} color={p.primaryText} />
          </Pressable>
        </View>

        <View style={[s.heroCard, { backgroundColor: p.primaryDark }]}>
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroEyebrow}>TOTAL BALANCE</Text>
              {initialLoading ? <Text style={s.heroBalance}>Loading…</Text> : data.currencies.length ? data.currencies.map(item => (
                <View key={item.currencyCode} style={s.balanceLine}>
                  <Text style={s.currencyCode}>{item.currencyCode}</Text>
                  <Text style={s.heroBalance}>{money(item.balanceMinor, item.currencyCode)}</Text>
                </View>
              )) : <Text style={s.heroBalance}>No accounts yet</Text>}
            </View>
            <MaterialCommunityIcons name="wallet-outline" size={27} color="rgba(255,255,255,0.82)" />
          </View>
          <View style={s.heroDivider} />
          <View style={s.monthHeader}>
            <Text style={s.monthEyebrow}>THIS MONTH</Text>
            <View style={s.monthPicker}>
              <Pressable onPress={() => setSelectedMonth(value => shiftMonth(value, -1))} hitSlop={8} style={s.monthArrow} accessibilityRole="button" accessibilityLabel="Previous month">
                <MaterialCommunityIcons name="chevron-left" size={21} color="#FFFFFF" />
              </Pressable>
              <Text style={s.monthLabel}>{monthLabel}</Text>
              <Pressable onPress={() => setSelectedMonth(value => shiftMonth(value, 1))} hitSlop={8} style={s.monthArrow} accessibilityRole="button" accessibilityLabel="Next month">
                <MaterialCommunityIcons name="chevron-right" size={21} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
          <View style={s.cashFlowGrid}>
            {data.currencies.length ? data.currencies.map(item => (
              <View key={item.currencyCode} style={s.cashFlowCurrency}>
                <Text style={s.cashFlowCode}>{item.currencyCode}</Text>
                <View style={s.cashFlowRow}>
                  <View style={s.cashFlowMetric}>
                    <Text style={s.cashFlowLabel}>Income</Text>
                    <Text style={s.cashFlowValue}>{money(item.incomeMinor, item.currencyCode)}</Text>
                  </View>
                  <View style={s.cashFlowMetric}>
                    <Text style={s.cashFlowLabel}>Expenses</Text>
                    <Text style={s.cashFlowValue}>{money(item.expenseMinor, item.currencyCode)}</Text>
                  </View>
                </View>
                <View style={s.netRow}>
                  <Text style={s.netLabel}>Net</Text>
                  <Text style={s.netValue}>{money(item.incomeMinor - item.expenseMinor, item.currencyCode)}</Text>
                </View>
              </View>
            )) : <Text style={s.heroHint}>{initialLoading ? "Loading this month’s activity…" : "Your income and expenses will appear here."}</Text>}
          </View>
          <View style={s.heroFooter}>
            <Text style={s.heroHint}>{activeAccounts} active {activeAccounts === 1 ? "account" : "accounts"}</Text>
            {selectedMonth !== currentMonth() ? <Pressable onPress={() => setSelectedMonth(currentMonth())}><Text style={s.currentMonthLink}>Back to this month</Text></Pressable> : null}
          </View>
        </View>

        <Pressable onPress={() => router.push("/(tabs)/transactions?quick=expense")}
          style={[s.logExpenseButton, { backgroundColor: p.primary }]} accessibilityRole="button" accessibilityLabel="Log an expense">
          <MaterialCommunityIcons name="plus-circle-outline" size={21} color={p.onPrimary} />
          <Text style={[s.logExpenseText, { color: p.onPrimary }]}>Log Expense</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={p.onPrimary} />
        </Pressable>

        <SectionHeader title="Budgets" actionLabel="See all" onAction={() => router.push("/budgets")} />
        {data.budgets.length ? data.budgets.map(item => {
          const over = item.spentMinor > item.amountMinor;
          const progress = item.amountMinor > 0 ? item.spentMinor / item.amountMinor : 0;
          return (
            <View key={item.id} style={[s.budgetCard, { backgroundColor: p.surface, borderColor: p.border }]}>
              <View style={s.budgetTop}>
                <View style={[s.smallIcon, { backgroundColor: p.primarySoft }]}>
                  <MaterialCommunityIcons name="chart-donut" size={18} color={p.primaryText} />
                </View>
                <View style={s.itemMain}>
                  <Text style={[s.itemTitle, { color: p.text }]} numberOfLines={1}>{item.categoryName}</Text>
                  <Text style={[s.itemSub, { color: p.textMuted }]} numberOfLines={1}>{item.accountName} · {item.period}</Text>
                </View>
                <Text style={[s.itemAmount, { color: over ? p.expense : p.text }]}>{money(item.spentMinor, item.currencyCode)}</Text>
              </View>
              <ProgressBar progress={progress} color={over ? p.expense : p.primary} track={p.border} />
              <View style={s.budgetFoot}>
                <Text style={[s.progressCaption, { color: p.textMuted }]}>{money(item.amountMinor, item.currencyCode)} limit</Text>
                <Text style={[s.progressCaption, { color: over ? p.expense : p.textMuted }]}>{over ? money(item.spentMinor - item.amountMinor, item.currencyCode) + " over" : money(item.amountMinor - item.spentMinor, item.currencyCode) + " left"}</Text>
              </View>
            </View>
          );
        }) : <EmptyState icon="chart-donut" title="No budgets yet" message="Create a spending limit to keep your expenses on track." actionLabel="Create a budget" onAction={() => router.push("/budgets")} palette={p} dark={dark} />}

        <SectionHeader title="Recent Activity" actionLabel="See all" onAction={() => router.push("/(tabs)/transactions")} />
        {data.activity.length ? data.activity.map(item => {
          const icon = item.kind === "income" ? "arrow-down-circle-outline" : item.kind === "expense" ? "arrow-up-circle-outline" : item.kind === "transfer" ? "swap-horizontal" : item.kind === "savings" ? "piggy-bank-outline" : item.kind === "loan" ? "hand-coin-outline" : "calendar-check-outline";
          const amountColor = item.kind === "income" ? p.income : item.kind === "expense" ? p.expense : p.text;
          const prefix = item.kind === "income" ? "+" : item.kind === "expense" ? "−" : "";
          return (
            <Pressable key={item.kind + "-" + item.id} onPress={() => router.push("/(tabs)/transactions")} style={[s.activityRow, { backgroundColor: p.surface, borderColor: p.border }]}>
              <View style={[s.smallIcon, { backgroundColor: dark ? p.surfaceElevated : "#F1F3F7" }]}>
                <MaterialCommunityIcons name={icon} size={19} color={amountColor} />
              </View>
              <View style={s.itemMain}>
                <Text style={[s.itemTitle, { color: p.text }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[s.itemSub, { color: p.textMuted }]} numberOfLines={1}>{item.subtitle} · {shortDate(item.occurredAt)}</Text>
              </View>
              <Text style={[s.itemAmount, { color: amountColor }]}>{prefix}{money(item.amountMinor, item.currencyCode)}</Text>
            </Pressable>
          );
        }) : <EmptyState icon="receipt-text-outline" title="No recent activity" message="Your recorded income, expenses, and transfers will appear here." actionLabel="Log an expense" onAction={() => router.push("/(tabs)/transactions?quick=expense")} palette={p} dark={dark} />}

        {error ? <Text style={[s.errorText, { color: p.expense }]}>{error}</Text> : null}
        {loading && !initialLoading ? <View style={s.loadingRow}><ActivityIndicator size="small" color={p.primary} /><Text style={[s.loadingText, { color: p.textMuted }]}>Updating overview…</Text></View> : null}
        <Text style={[s.footerText, { color: p.textMuted }]}>Your financial data stays on this device.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 34, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  brand: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  greeting: { fontSize: 27, fontWeight: "800", letterSpacing: -0.7, marginTop: 3 },
  headerAction: { width: 44, height: 44, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  heroCard: { borderRadius: 20, padding: 18, marginTop: 2 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroEyebrow: { color: "rgba(255,255,255,0.76)", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  balanceLine: { marginTop: 7 },
  currencyCode: { color: "rgba(255,255,255,0.72)", fontSize: 10, fontWeight: "700", marginBottom: 2 },
  heroBalance: { color: "#FFFFFF", fontSize: 25, fontWeight: "800", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  heroDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.22)", marginTop: 16, marginBottom: 13 },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  monthEyebrow: { color: "rgba(255,255,255,0.76)", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  monthPicker: { flexDirection: "row", alignItems: "center", gap: 5 },
  monthArrow: { width: 32, height: 34, alignItems: "center", justifyContent: "center" },
  monthLabel: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  cashFlowGrid: { marginTop: 10, gap: 9 },
  cashFlowCurrency: { backgroundColor: "rgba(0,0,0,0.10)", borderRadius: 12, padding: 11 },
  cashFlowCode: { color: "rgba(255,255,255,0.72)", fontSize: 9, fontWeight: "800", letterSpacing: 0.5, marginBottom: 7 },
  cashFlowRow: { flexDirection: "row", gap: 12 },
  cashFlowMetric: { flex: 1, minWidth: 0, gap: 3 },
  cashFlowLabel: { color: "rgba(255,255,255,0.70)", fontSize: 10, fontWeight: "600" },
  cashFlowValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  netRow: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)", marginTop: 9, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  netLabel: { color: "rgba(255,255,255,0.72)", fontSize: 10, fontWeight: "700" },
  netValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
  heroFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  heroHint: { color: "rgba(255,255,255,0.72)", fontSize: 11 },
  currentMonthLink: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  logExpenseButton: { minHeight: 54, borderRadius: 15, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 1, marginBottom: 3 },
  logExpenseText: { fontSize: 14, fontWeight: "800", flex: 1 },
  budgetCard: { borderWidth: 1, borderRadius: 15, padding: 13, marginBottom: 8, gap: 10 },
  budgetTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  smallIcon: { width: 35, height: 35, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  itemMain: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 13, fontWeight: "700" },
  itemSub: { fontSize: 11, marginTop: 3 },
  itemAmount: { fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },
  progressTrack: { height: 7, borderRadius: 5, overflow: "hidden" },
  progressFill: { height: 7, borderRadius: 5 },
  budgetFoot: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  progressCaption: { fontSize: 10, fontWeight: "600" },
  activityRow: { borderWidth: 1, borderRadius: 14, padding: 11, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 9 },
  errorText: { fontSize: 12, marginTop: 10 },
  loadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 8 },
  loadingText: { fontSize: 11 },
  footerText: { fontSize: 10, textAlign: "center", marginTop: 14 },
});
