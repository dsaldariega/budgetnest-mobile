import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  createActivityRepository,
  type ActivityEntityFilter,
  type ActivityLogItem,
  type ActivityPeriod,
} from "@/database/repositories/activity-repository";
import { activityActionLabel, activityEntityLabel, activityIconName } from "@/domain/activity";
import { ScreenBackButton } from "@/components/ui/screen-back-button";
import { colors } from "@/theme/colors";

const ENTITY_FILTERS: { value: ActivityEntityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "account", label: "Accounts" },
  { value: "transaction", label: "Transactions" },
  { value: "budget", label: "Budgets" },
  { value: "goal", label: "Goals" },
  { value: "loan", label: "Loans" },
  { value: "subscription", label: "Subscriptions" },
  { value: "recurring", label: "Recurring" },
];

const PERIOD_FILTERS: { value: ActivityPeriod; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "all", label: "All time" },
];

const formatDate = (value: string) => new Date(value).toLocaleString("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function ActivityLogScreen() {
  const db = useSQLiteContext();
  const dark = useColorScheme() === "dark";
  const palette = dark ? colors.dark : colors.light;
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [entityFilter, setEntityFilter] = useState<ActivityEntityFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<ActivityPeriod>("30");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const repository = useMemo(() => createActivityRepository(db), [db]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [activities, today] = await Promise.all([
        repository.list({ entityType: entityFilter, period: periodFilter, limit: 500 }),
        repository.countToday(),
      ]);
      setItems(activities);
      setTodayCount(today);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load activity.");
    } finally {
      setLoading(false);
    }
  }, [repository, entityFilter, periodFilter]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter((item) => [
      activityActionLabel(item.action),
      item.entityType,
      item.summary,
      item.action,
    ].join(" ").toLocaleLowerCase().includes(query));
  }, [items, search]);

  const chipStyle = (active: boolean) => [
    styles.chip,
    {
      backgroundColor: active ? (dark ? "#3A2424" : "#FCE8E8") : palette.surface,
      borderColor: active ? palette.primary : palette.border,
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <ScreenBackButton backgroundColor={palette.surface} borderColor={palette.border} color={palette.text} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: palette.primary }]}>YOUR HISTORY</Text>
            <Text style={[styles.title, { color: palette.text }]}>Activity Log</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh activity" onPress={() => void load()} disabled={loading} style={styles.refresh}>
            <MaterialCommunityIcons name="refresh" size={21} color={palette.primary} />
          </Pressable>
        </View>

        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          A timeline of changes made across your BudgetNest records.
        </Text>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>IN SELECTED PERIOD</Text>
            <Text style={[styles.summaryValue, { color: palette.text }]}>{items.length}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>RECORDED TODAY</Text>
            <Text style={[styles.summaryValue, { color: palette.text }]}>{todayCount}</Text>
          </View>
        </View>

        <View style={[styles.searchBox, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <MaterialCommunityIcons name="magnify" size={19} color={palette.textMuted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search activity" placeholderTextColor={palette.textMuted} style={[styles.searchInput, { color: palette.text }]} />
          {search ? <Pressable onPress={() => setSearch("")}><MaterialCommunityIcons name="close-circle" size={18} color={palette.textMuted} /></Pressable> : null}
        </View>

        <Text style={[styles.filterLabel, { color: palette.textMuted }]}>ACTIVITY TYPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {ENTITY_FILTERS.map((item) => (
            <Pressable key={item.value} onPress={() => setEntityFilter(item.value)} style={chipStyle(entityFilter === item.value)}>
              <Text style={{ color: entityFilter === item.value ? palette.primary : palette.text, fontSize: 11, fontWeight: "800" }}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.filterLabel, { color: palette.textMuted }]}>DATE RANGE</Text>
        <View style={styles.filterRow}>
          {PERIOD_FILTERS.map((item) => (
            <Pressable key={item.value} onPress={() => setPeriodFilter(item.value)} style={chipStyle(periodFilter === item.value)}>
              <Text style={{ color: periodFilter === item.value ? palette.primary : palette.text, fontSize: 11, fontWeight: "800" }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <View style={[styles.empty, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={{ color: palette.textMuted }}>Loading activity…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: dark ? "#30323A" : "#EEF1F5" }]}>
              <MaterialCommunityIcons name="history" size={27} color={palette.textMuted} />
            </View>
            <Text style={[styles.itemTitle, { color: palette.text }]}>
              {items.length ? "No matching activity" : "Your activity will appear here"}
            </Text>
            <Text style={[styles.emptyText, { color: palette.textMuted }]}>
              {items.length ? "Try another search or filter." : "Create an account, record a transaction, or manage a budget to start building your activity history."}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {filtered.map((item) => (
              <View key={item.id} style={[styles.activityCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={[styles.activityIcon, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}>
                  <MaterialCommunityIcons name={activityIconName(item.entityType) as never} size={20} color={palette.primary} />
                </View>
                <View style={styles.activityCopy}>
                  <Text style={[styles.itemTitle, { color: palette.text }]}>{activityActionLabel(item.action)}</Text>
                  <Text style={[styles.itemSummary, { color: palette.textMuted }]}>{item.summary}</Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.entityLabel, { color: palette.primary }]}>{activityEntityLabel(item.entityType)}</Text>
                    <Text style={[styles.dateLabel, { color: palette.textMuted }]}>{formatDate(item.createdAt)}</Text>
                  </View>
                </View>
              </View>
            ))}
            <Text style={[styles.footer, { color: palette.textMuted }]}>Showing up to 500 recent activity records.</Text>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 18, paddingTop: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 11 },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: "900", marginTop: 2 },
  refresh: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 9, marginBottom: 15 },
  summaryRow: { flexDirection: "row", gap: 9, marginBottom: 14 },
  summaryCard: { flex: 1, borderWidth: 1, borderRadius: 13, padding: 12, gap: 5 },
  summaryLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  summaryValue: { fontSize: 23, fontWeight: "900" },
  searchBox: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 13 },
  filterLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8, marginTop: 14, marginBottom: 7 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 8 },
  list: { gap: 9, paddingTop: 14, paddingBottom: 30 },
  activityCard: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 11 },
  activityIcon: { width: 39, height: 39, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  activityCopy: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 13, fontWeight: "800" },
  itemSummary: { fontSize: 11, lineHeight: 16 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 5, marginTop: 3 },
  entityLabel: { fontSize: 9, fontWeight: "800" },
  dateLabel: { fontSize: 9 },
  footer: { fontSize: 10, textAlign: "center", marginTop: 4 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", marginTop: 13 },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyText: { textAlign: "center", fontSize: 11, lineHeight: 17, marginTop: 7 },
  error: { color: "#D32F2F", fontSize: 11, marginTop: 10 },
});
