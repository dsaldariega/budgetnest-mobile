import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { createHistoryRepository, type HistoryFilter, type HistoryItem } from "@/database/repositories/history-repository";
import { historyAmountPrefix, historyKindLabel } from "@/domain/history";
import { colors } from "@/theme/colors";

const fmt = (n: number, c: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n / 100);

function kindColor(kind: HistoryItem["kind"], palette: typeof colors.light) {
  if (kind === "income") return palette.income;
  if (kind === "expense") return palette.expense;
  if (kind === "transfer") return palette.primary;
  return palette.secondary;
}

export default function TransactionsScreen() {
  const db = useSQLiteContext();
  const dark = useColorScheme() === "dark";
  const p = dark ? colors.dark : colors.light;
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [error, setError] = useState("");

  const repo = useMemo(() => createHistoryRepository(db), [db]);

  const load = useCallback(async () => {
    try {
      const history = await repo.list({ filter, search, fromDate: fromDate || undefined, toDate: toDate || undefined });
      setItems(history);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load financial history.");
    }
  }, [repo, filter, search, fromDate, toDate]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const clearFilters = () => {
    setFilter("all");
    setSearch("");
    setFromDate("");
    setToDate("");
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: p.background }]} edges={["top", "left", "right"]}>
      <View style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={{ color: p.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>FINANCIAL HISTORY</Text>
            <Text style={[s.title, { color: p.text }]}>Activity</Text>
          </View>
        </View>
        <Text style={[s.sub, { color: p.textMuted }]}>One place for transactions, loan payments, subscriptions, and savings.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {(["all", "income", "expense", "transfer", "loan", "subscription", "savings"] as HistoryFilter[]).map(kind => (
            <Pressable key={kind} onPress={() => setFilter(kind)} style={[s.filter, { backgroundColor: filter === kind ? p.primary : p.surface, borderColor: filter === kind ? p.primary : p.border }]}>
              <Text style={{ color: filter === kind ? "#fff" : p.text, fontWeight: "700", fontSize: 12 }}>{historyKindLabel(kind)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={[s.searchBox, { backgroundColor: p.surface, borderColor: p.border }]}>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search activity" placeholderTextColor={p.textMuted} style={[s.searchInput, { color: p.text }]} />
          {search || fromDate || toDate || filter !== "all" ? <Pressable onPress={clearFilters}><Text style={{ color: p.primary, fontWeight: "700", fontSize: 12 }}>Clear</Text></Pressable> : null}
        </View>

        <View style={s.dateRow}>
          <TextInput value={fromDate} onChangeText={setFromDate} placeholder="From YYYY-MM-DD" placeholderTextColor={p.textMuted} style={[s.dateInput, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
          <TextInput value={toDate} onChangeText={setToDate} placeholder="To YYYY-MM-DD" placeholderTextColor={p.textMuted} style={[s.dateInput, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        </View>

        {error ? <View style={[s.error, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}><Text style={{ color: p.primary, fontWeight: "800", fontSize: 12 }}>Unable to load activity</Text><Text style={{ color: p.text, fontSize: 12, marginTop: 4 }}>{error}</Text></View> : null}

        <ScrollView contentContainerStyle={s.list}>
          {items.length === 0 ? (
            <View style={[s.empty, { backgroundColor: p.surface, borderColor: p.border }]}>
              <Text style={[s.itemTitle, { color: p.text }]}>No activity found</Text>
              <Text style={{ color: p.textMuted, fontSize: 13, marginTop: 6 }}>Try a different filter, date range, or search term.</Text>
            </View>
          ) : items.map(item => {
            const prefix = historyAmountPrefix(item.kind);
            return (
              <Pressable key={item.kind + "-" + item.id} onPress={() => setSelected(item)} style={[s.card, { backgroundColor: p.surface, borderColor: p.border }]}>
                <View style={s.itemRow}>
                  <View style={[s.dot, { backgroundColor: kindColor(item.kind, p) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemTitle, { color: p.text }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ color: p.textMuted, fontSize: 11, marginTop: 4 }} numberOfLines={1}>{historyKindLabel(item.kind)} · {item.subtitle}</Text>
                  </View>
                  <Text style={{ fontWeight: "800", fontSize: 12, color: item.kind === "income" ? p.income : item.kind === "expense" ? p.expense : p.text }}>
                    {prefix}{fmt(item.amountMinor, item.currencyCode)}
                  </Text>
                </View>
                <View style={s.bottom}>
                  <Text style={{ color: p.textMuted, fontSize: 11 }}>{item.occurredAt}</Text>
                  <Text style={{ color: p.textMuted, fontSize: 11 }}>{item.accountName ?? "No account"}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Modal visible={selected !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={[s.modal, { backgroundColor: p.background }]}>
          {selected ? (
            <ScrollView contentContainerStyle={s.detail}>
              <View style={s.header}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>{historyKindLabel(selected.kind).toUpperCase()}</Text>
                  <Text style={[s.modalTitle, { color: p.text }]}>{selected.title}</Text>
                </View>
                <Pressable onPress={() => setSelected(null)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable>
              </View>

              <View style={[s.detailCard, { backgroundColor: p.surface, borderColor: p.border }]}>
                <Text style={{ color: p.textMuted, fontSize: 12 }}>Amount</Text>
                <Text style={[s.hero, { color: selected.kind === "income" ? p.income : selected.kind === "expense" ? p.expense : p.text }]}>
                  {historyAmountPrefix(selected.kind)}{fmt(selected.amountMinor, selected.currencyCode)}
                </Text>
                <DetailRow label="Date" value={selected.occurredAt} color={p.text} muted={p.textMuted} />
                <DetailRow label="Account" value={selected.accountName ?? "No account"} color={p.text} muted={p.textMuted} />
                <DetailRow label="Category" value={selected.categoryName ?? "—"} color={p.text} muted={p.textMuted} />
                <DetailRow label="Details" value={selected.subtitle} color={p.text} muted={p.textMuted} />
                {selected.interestPaidMinor !== null ? <DetailRow label="Interest" value={fmt(selected.interestPaidMinor, selected.currencyCode)} color={p.text} muted={p.textMuted} /> : null}
                {selected.principalPaidMinor !== null ? <DetailRow label="Principal" value={fmt(selected.principalPaidMinor, selected.currencyCode)} color={p.text} muted={p.textMuted} /> : null}
              </View>

              {selected.notes ? <View style={[s.noteCard, { backgroundColor: p.surface, borderColor: p.border }]}><Text style={{ color: p.textMuted, fontSize: 12 }}>Note</Text><Text style={{ color: p.text, fontSize: 13, lineHeight: 20, marginTop: 6 }}>{selected.notes}</Text></View> : null}
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, color, muted }: { label: string; value: string; color: string; muted: string }) {
  return <View style={s.detailRow}><Text style={{ color: muted, fontSize: 12 }}>{label}</Text><Text style={{ color, fontSize: 13, fontWeight: "700", textAlign: "right", flexShrink: 1 }}>{value}</Text></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 29, fontWeight: "800", marginTop: 4 },
  sub: { fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 15 },
  filters: { gap: 7, paddingRight: 20, paddingBottom: 11 },
  filter: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 9 },
  searchBox: { minHeight: 46, borderWidth: 1, borderRadius: 13, flexDirection: "row", alignItems: "center", paddingHorizontal: 13 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13 },
  dateRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  dateInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 11 },
  list: { gap: 10, paddingTop: 12, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  itemTitle: { fontSize: 14, fontWeight: "700" },
  bottom: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 12 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 20, marginTop: 12 },
  error: { borderRadius: 14, padding: 12, marginTop: 10 },
  modal: { flex: 1 },
  detail: { padding: 22, paddingBottom: 48 },
  modalTitle: { fontSize: 23, fontWeight: "800", marginTop: 4 },
  detailCard: { borderWidth: 1, borderRadius: 18, padding: 18, marginTop: 18 },
  hero: { fontSize: 30, fontWeight: "800", marginTop: 7, marginBottom: 16 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(100,116,139,0.18)" },
  noteCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 10 },
});
