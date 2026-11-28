import { useAppTheme } from "@/theme/use-app-theme";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
type DashboardData = {
  accounts: AccountWithBalance[];
  currencies: CurrencySummary[];
  budgets: BudgetListItem[];
  activity: HistoryItem[];
};

const today = todayLocalDate;
const currentMonth = () => today().slice(0, 7);
const monthDate = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1);
const shiftMonth = (month: string, offset: number) => {
  const date = monthDate(month);
  date.setMonth(date.getMonth() + offset);
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
};
const monthBounds = (month: string) => {
  const start = month + "-01";
  const next = shiftMonth(month, 1) + "-01";
  const endDate = new Date(Number(next.slice(0, 4)), Number(next.slice(5, 7)) - 1, 0);
  const end = month + "-" + String(endDate.getDate()).padStart(2, "0") + "T23:59:59.999";
  return { start, end };
};
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-PH", {
  style: "currency", currency, maximumFractionDigits: 2,
}).format(minor / 100);
const monthTitle = (month: string) => monthDate(month).toLocaleDateString("en-PH", { month: "long", year: "numeric" });
const shortDate = (value: string) => new Date(value.slice(0, 10) + "T00:00:00").toLocaleDateString("en-PH", {
  month: "short", day: "numeric",
});

function ProgressBar({ progress, color, track }: { progress: number; color: string; track: string }) {
  return <View style={[s.progressTrack, { backgroundColor: track }]}><View style={[s.progressFill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%`, backgroundColor: color }]} /></View>;
}

function QuickAction({ label, icon, onPress, palette, tone = "primary" }: {
  label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress: () => void;
  palette: ReturnType<typeof useAppTheme>["palette"]; tone?: "primary" | "income" | "neutral";
}) {
  const tint = tone === "income" ? palette.income : tone === "neutral" ? palette.secondary : palette.primary;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={[s.quickAction, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={[s.quickIcon, { backgroundColor: tone === "income" ? palette.successSoft : tone === "neutral" ? palette.surfaceElevated : palette.primarySoft }]}>
        <MaterialCommunityIcons name={icon} size={19} color={tint} />
      </View>
      <Text style={[s.quickLabel, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { isDark: dark, palette: p } = useAppTheme();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [data, setData] = useState<DashboardData>({ accounts: [], currencies: [], budgets: [], activity: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const date = today();
      const month = selectedMonth;
      const bounds = monthBounds(month);
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
          month,
        ),
      ]);

      const safeAccounts = Array.isArray(accounts) ? accounts : [];
      const safeMonthlyRows = Array.isArray(monthlyRows) ? monthlyRows : [];
      const currencyCodes = new Set([...safeAccounts.map(a => a.currencyCode), ...safeMonthlyRows.map(row => row.currency_code)]);
      const currencies = [...currencyCodes].sort().map(currencyCode => {
        const monthly = safeMonthlyRows.find(row => row.currency_code === currencyCode);
        return {
          currencyCode,
          balanceMinor: safeAccounts.filter(account => account.currencyCode === currencyCode).reduce((sum, account) => sum + account.balanceMinor, 0),
          incomeMinor: monthly?.income_minor ?? 0,
          expenseMinor: monthly?.expense_minor ?? 0,
        };
      });

      const safeBudgets = (Array.isArray(budgets) ? budgets : [])
        .filter(item => item.startDate <= date && (!item.endDate || item.endDate >= date))
        .slice(0, 3);
      const safeActivity = (Array.isArray(activity) ? activity : []).slice(0, 5);
      setData({ accounts: safeAccounts, currencies, budgets: safeBudgets, activity: safeActivity });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load your financial overview.");
    } finally {
      setLoading(false);
    }
  }, [db, selectedMonth]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const monthLabel = useMemo(() => monthTitle(selectedMonth), [selectedMonth]);
  const totalAccounts = data.accounts.filter(account => !account.isArchived).length;
  const hasCurrencies = data.currencies.length > 0;

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

        <View style={[s.monthSelector, { backgroundColor: p.surface, borderColor: p.border }]}>
          <Pressable onPress={() => setSelectedMonth(value => shiftMonth(value, -1))} hitSlop={8} style={s.monthArrow} accessibilityRole="button" accessibilityLabel="Previous month">
            <MaterialCommunityIcons name="chevron-left" size={22} color={p.text} />
          </Pressable>
          <View style={s.monthCenter}>
            <Text style={[s.monthLabel, { color: p.text }]}>{monthLabel}</Text>
            {selectedMonth !== currentMonth() ? <Pressable onPress={() => setSelectedMonth(currentMonth())}><Text style={[s.todayLink, { color: p.primaryText }]}>Back to this month</Text></Pressable> : null}
          </View>
          <Pressable onPress={() => setSelectedMonth(value => shiftMonth(value, 1))} hitSlop={8} style={s.monthArrow} accessibilityRole="button" accessibilityLabel="Next month">
            <MaterialCommunityIcons name="chevron-right" size={22} color={p.text} />
          </Pressable>
        </View>

        <View style={[s.balanceCard, { backgroundColor: p.primaryDark }]}>
          <View style={s.balanceHeading}>
            <View style={s.balanceLabelRow}>
              <MaterialCommunityIcons name="wallet-outline" size={17} color="#FFFFFF" />
              <Text style={s.balanceEyebrow}>TOTAL BALANCE</Text>
            </View>
            <MaterialCommunityIcons name="sprout" size={23} color="rgba(255,255,255,0.8)" />
          </View>
          {loading ? <Text style={s.balanceAmount}>Loading…</Text> : !hasCurrencies
            ? <Text style={s.balanceAmount}>No accounts yet</Text>
            : data.currencies.map(item => (
              <View key={item.currencyCode} style={s.balanceLine}>
                <Text style={s.currencyCode}>{item.currencyCode}</Text>
                <Text style={s.balanceAmount}>{money(item.balanceMinor, item.currencyCode)}</Text>
              </View>
            ))}
          <View style={s.balanceFooter}>
            <Text style={s.balanceFootText}>{totalAccounts} active {totalAccounts === 1 ? "account" : "accounts"}</Text>
            <Pressable onPress={() => router.push("/(tabs)/accounts")} style={s.balanceLink}>
              <Text style={s.balanceLinkText}>View accounts</Text>
              <MaterialCommunityIcons name="arrow-right" size={15} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={s.sectionHeading}>
          <Text style={[s.sectionTitle, { color: p.text }]}>Cash flow</Text>
          <Text style={[s.sectionCaption, { color: p.textMuted }]}>{monthLabel}</Text>
        </View>
        <View style={s.metricsGrid}>
          {data.currencies.length ? data.currencies.map(item => (
            <View key={item.currencyCode} style={[s.metricCard, { backgroundColor: p.surface, borderColor: p.border }]}>
              <Text style={[s.metricCurrency, { color: p.textMuted }]}>{item.currencyCode}</Text>
              <View style={s.metricRow}>
                <View style={s.metricBlock}>
                  <Text style={[s.metricLabel, { color: p.textMuted }]}>Income</Text>
                  <Text style={[s.metricValue, { color: p.income }]}>{money(item.incomeMinor, item.currencyCode)}</Text>
                </View>
                <View style={s.metricBlock}>
                  <Text style={[s.metricLabel, { color: p.textMuted }]}>Expenses</Text>
                  <Text style={[s.metricValue, { color: p.expense }]}>{money(item.expenseMinor, item.currencyCode)}</Text>
                </View>
              </View>
              <View style={[s.netRow, { borderTopColor: p.border }]}>
                <Text style={[s.netLabel, { color: p.textMuted }]}>Net cash flow</Text>
                <Text style={[s.netValue, { color: item.incomeMinor - item.expenseMinor >= 0 ? p.income : p.expense }]}>{money(item.incomeMinor - item.expenseMinor, item.currencyCode)}</Text>
              </View>
            </View>
          )) : (
            <View style={[s.noMetrics, { backgroundColor: p.surface, borderColor: p.border }]}>
              <Text style={[s.noMetricsText, { color: p.textMuted }]}>{loading ? "Loading monthly totals…" : "No income or expenses recorded for this month."}</Text>
            </View>
          )}
        </View>

        <View style={s.quickActions}>
          <QuickAction label="Income" icon="arrow-down-left" tone="income" palette={p} onPress={() => router.push("/(tabs)/transactions?quick=income")} />
          <QuickAction label="Expense" icon="arrow-up-right" palette={p} onPress={() => router.push("/(tabs)/transactions?quick=expense")} />
          <QuickAction label="Transfer" icon="swap-horizontal" tone="neutral" palette={p} onPress={() => router.push("/(tabs)/transactions?quick=transfer")} />
        </View>

        <SectionHeader title="Budgets" actionLabel="See all" onAction={() => router.push("/(tabs)/budgets")} />
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
        }) : <EmptyState icon="chart-donut" title="No active budgets" message="Create a budget to set a spending limit and track progress." actionLabel="Create a budget" onAction={() => router.push("/(tabs)/budgets")} palette={p} dark={dark} />}

        <SectionHeader title="Recent transactions" actionLabel="See all" onAction={() => router.push("/(tabs)/transactions")} />
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
        }) : <EmptyState icon="receipt-text-outline" title="No transactions this month" message="Your income and expenses will appear here once recorded." actionLabel="Add transaction" onAction={() => router.push("/(tabs)/transactions?quick=expense")} palette={p} dark={dark} />}

        {error ? <Text style={[s.errorText, { color: p.expense }]}>{error}</Text> : null}
        {loading ? <Text style={[s.loadingText, { color: p.textMuted }]}>Refreshing your overview…</Text> : null}
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
  monthSelector: { minHeight: 52, borderWidth: 1, borderRadius: 15, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  monthArrow: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  monthCenter: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 44 },
  monthLabel: { fontSize: 14, fontWeight: "800" },
  todayLink: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  balanceCard: { borderRadius: 20, padding: 18, marginTop: 2 },
  balanceHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  balanceLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  balanceEyebrow: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  balanceLine: { marginBottom: 9 },
  currencyCode: { color: "rgba(255,255,255,0.72)", fontSize: 10, fontWeight: "700", marginBottom: 2 },
  balanceAmount: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  balanceFooter: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.22)", marginTop: 8, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balanceFootText: { color: "rgba(255,255,255,0.76)", fontSize: 12 },
  balanceLink: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 4 },
  balanceLinkText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: -2 },
  sectionTitle: { fontSize: 17, fontWeight: "800" },
  sectionCaption: { fontSize: 11, fontWeight: "600" },
  metricsGrid: { gap: 9 },
  metricCard: { borderWidth: 1, borderRadius: 15, padding: 14, gap: 10 },
  metricCurrency: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  metricRow: { flexDirection: "row", gap: 12 },
  metricBlock: { flex: 1, minWidth: 0, gap: 4 },
  metricLabel: { fontSize: 11, fontWeight: "600" },
  metricValue: { fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  netRow: { borderTopWidth: 1, paddingTop: 9, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  netLabel: { fontSize: 11, fontWeight: "600" },
  netValue: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  noMetrics: { borderWidth: 1, borderRadius: 14, padding: 15 },
  noMetricsText: { fontSize: 12, lineHeight: 18 },
  quickActions: { flexDirection: "row", gap: 9, marginTop: 1, marginBottom: 3 },
  quickAction: { flex: 1, minHeight: 76, borderWidth: 1, borderRadius: 15, paddingVertical: 10, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", gap: 6 },
  quickIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 11, fontWeight: "800" },
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
  loadingText: { fontSize: 11, textAlign: "center", marginTop: 8 },
  footerText: { fontSize: 10, textAlign: "center", marginTop: 14 },
});
