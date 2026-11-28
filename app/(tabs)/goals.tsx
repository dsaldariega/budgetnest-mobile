import { useAppTheme } from "@/theme/use-app-theme";
import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAccountRepository, type AccountWithBalance } from "@/database/repositories/account-repository";
import { createGoalRepository, type SavingsGoalListItem } from "@/database/repositories/goal-repository";
import { toMinorUnits } from "@/domain/money";
import { compareDates, todayLocalDate } from "@/domain/dates";
import { colors } from "@/theme/colors";
import { SelectField } from "@/components/ui/select-field";
import { DateField } from "@/components/ui/date-field";

const makeId = (p: string) => p + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
const today = todayLocalDate;
const fmt = (n: number, c: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n / 100);

export default function GoalsScreen() {
  const db = useSQLiteContext(); const { isDark: dark, palette: p } = useAppTheme();
  const [items, setItems] = useState<SavingsGoalListItem[]>([]); const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [open, setOpen] = useState(false); const [editingGoal, setEditingGoal] = useState<SavingsGoalListItem | null>(null); const [contributeGoal, setContributeGoal] = useState<SavingsGoalListItem | null>(null);
  const [name, setName] = useState(""); const [target, setTarget] = useState(""); const [targetDate, setTargetDate] = useState(""); const [accountId, setAccountId] = useState("");
  const [contribution, setContribution] = useState(""); const [contributionNote, setContributionNote] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const [goals, acc] = await Promise.all([createGoalRepository(db).list(), createAccountRepository(db).list()]); const safeGoals = Array.isArray(goals) ? goals : []; const safeAccounts = Array.isArray(acc) ? acc : []; setItems(safeGoals); setAccounts(safeAccounts); setAccountId(v => safeAccounts.some(a => a.id === v) ? v : safeAccounts[0]?.id ?? ""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load goals."); }
  }, [db]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const reset = () => { setName(""); setTarget(""); setTargetDate(""); setError(""); setEditingGoal(null); };
  const openEdit = (item: SavingsGoalListItem) => { setError(""); setEditingGoal(item); setName(item.name); setTarget((item.targetAmountMinor / 100).toFixed(2)); setTargetDate(item.targetDate ?? ""); setAccountId(item.accountId); setOpen(true); };
  const save = async () => {
    setError("");
    if (!/^\d+(\.\d{1,2})?$/.test(target.trim()) || Number(target) <= 0) { setError("Enter a positive target amount."); return; }
    try {
      if (!name.trim()) throw new Error("Enter a goal name.");
      if (!accountId) throw new Error("Choose an account.");
      if (targetDate) compareDates(targetDate, targetDate);
      setSaving(true);
      const repository = createGoalRepository(db);
      if (editingGoal) {
        await repository.update(editingGoal.id, { name, targetAmountMinor: toMinorUnits(Number(target)), targetDate: targetDate || null, accountId });
      } else {
        await repository.create({ id: makeId("goal"), name, targetAmountMinor: toMinorUnits(Number(target)), targetDate: targetDate || null, accountId });
      }
      setOpen(false); reset(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save goal."); } finally { setSaving(false); }
  };
  const addContribution = async () => {
    setError("");
    if (!/^\d+(\.\d{1,2})?$/.test(contribution.trim()) || Number(contribution) <= 0) { setError("Enter a positive contribution."); return; }
    try {
      setSaving(true);
      await createGoalRepository(db).addContribution({ id: makeId("contribution"), goalId: contributeGoal!.id, amountMinor: toMinorUnits(Number(contribution)), contributedAt: today(), note: contributionNote.trim() || null });
      setContributeGoal(null); setContribution(""); setContributionNote(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to add contribution."); } finally { setSaving(false); }
  };
  const remove = async (item: SavingsGoalListItem) => {
    try {
      const impact = await createGoalRepository(db).getDeleteImpact(item.id);
      Alert.alert(
        "Delete goal and contribution history?",
        `“${item.name}” and all ${impact.contributions} recorded contribution(s) will be permanently deleted. This action cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete goal", style: "destructive", onPress: async () => {
            try { await createGoalRepository(db).delete(item.id); await load(); }
            catch (e) { Alert.alert("Unable to delete goal", e instanceof Error ? e.message : "Please try again."); }
          } },
        ],
      );
    } catch (e) {
      Alert.alert("Unable to check goal history", e instanceof Error ? e.message : "Please try again.");
    }
  };
  const archive = (item: SavingsGoalListItem) => Alert.alert("Archive goal?", "“" + item.name + "” will be hidden from active goals. Its contribution history will be kept.", [
    { text: "Cancel", style: "cancel" }, { text: "Archive", style: "destructive", onPress: async () => { try { await createGoalRepository(db).archive(item.id); await load(); } catch (e) { Alert.alert("Unable to archive", e instanceof Error ? e.message : "Please try again."); } } },
  ]);
  return <SafeAreaView style={[s.safe, { backgroundColor: p.background }]} edges={["top", "left", "right"]}>
    <View style={s.page}>
      <View style={s.header}><View><Text style={{ color: p.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>SAVE WITH PURPOSE</Text><Text style={[s.title, { color: p.text }]}>Goals</Text></View><Pressable onPress={() => { reset(); setOpen(true); }} style={[s.add, { backgroundColor: p.primary }]}><Text style={[s.addText, { color: p.onPrimary }]}>+ Add</Text></Pressable></View>
      <Text style={[s.sub, { color: p.textMuted }]}>Build progress toward something that matters to you.</Text>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? <View style={[s.empty, { backgroundColor: p.surface, borderColor: p.border }]}><Text style={[s.cardTitle, { color: p.text }]}>No savings goals yet</Text><Text style={{ color: p.textMuted, marginTop: 6 }}>Create a goal, then record contributions as you save.</Text><Pressable onPress={() => setOpen(true)} style={[s.primary, { backgroundColor: p.primary }]}><Text style={[s.primaryText, { color: p.onPrimary }]}>Create a goal</Text></Pressable></View> :
        items.map(item => <View key={item.id} style={[s.card, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={s.row}><View style={{ flex: 1 }}><Text style={[s.cardTitle, { color: p.text }]}>{item.name}</Text><Text style={{ color: p.textMuted, fontSize: 11, marginTop: 3 }}>{item.accountName} · {item.currencyCode}{item.targetDate ? " · target " + item.targetDate : ""}</Text></View><View style={{ alignItems: "flex-end", gap: 8 }}><Pressable onPress={() => openEdit(item)}><Text style={s.archive}>Edit</Text></Pressable><Pressable onPress={() => archive(item)}><Text style={[s.archive, { color: p.textMuted }]}>Archive</Text></Pressable><Pressable onPress={() => void remove(item)}><Text style={[s.archive, { color: p.expense }]}>Delete</Text></Pressable></View></View>
          <View style={s.moneyRow}><Text style={[s.current, { color: p.text }]}>{fmt(item.currentAmountMinor, item.currencyCode)}</Text><Text style={{ color: p.textMuted, fontSize: 12 }}>of {fmt(item.targetAmountMinor, item.currencyCode)}</Text></View>
          <View style={[s.track, { backgroundColor: dark ? "#332B2B" : "#EEEFF2" }]}><View style={[s.fill, { width: Math.min(100, Math.round(item.progress * 100)) + "%", backgroundColor: p.income }]} /></View>
          <View style={s.moneyRow}><Text style={{ color: p.textMuted, fontSize: 12 }}>{fmt(item.remainingMinor, item.currencyCode)} remaining</Text><Pressable onPress={() => { setError(""); setContributeGoal(item); }}><Text style={[s.contribute, { color: p.primary }]}>+ Add contribution</Text></Pressable></View>
        </View>)}
      </ScrollView>
    </View>
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() =>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}> setOpen(false)}><SafeAreaView style={[s.modal, { backgroundColor: p.background }]}><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
      <View style={s.header}><Text style={[s.modalTitle, { color: p.text }]}>{editingGoal ? "Edit savings goal" : "Add savings goal"}</Text><Pressable onPress={() => setOpen(false)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
      <Text style={[s.label, { color: p.text }]}>Goal name</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Emergency fund" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
      <Text style={[s.label, { color: p.text }]}>Target amount</Text><TextInput value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input, s.amount, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
      <SelectField label="Account" required value={accountId} options={(accounts ?? []).filter(a=>!a.isArchived).map(a=>({value:a.id,label:a.name,description:a.currencyCode}))} onChange={setAccountId} placeholder="Select account" />
      <DateField label="Target date (optional)" value={targetDate} onChange={setTargetDate} placeholder="No target date" />
      {error ? <Text style={[s.error, { color: p.expense }]}>{error}</Text> : null}<Pressable disabled={saving} onPress={save} style={[s.primary, { backgroundColor: p.primary, opacity: saving ? 0.6 : 1 }]}><Text style={[s.primaryText, { color: p.onPrimary }]}>{saving ? "Saving…" : editingGoal ? "Save changes" : "Save goal"}</Text></Pressable>
    </ScrollView></SafeAreaView></KeyboardAvoidingView>
    </Modal>
    <Modal visible={!!contributeGoal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() =>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}> setContributeGoal(null)}><SafeAreaView style={[s.modal, { backgroundColor: p.background }]}><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
      <View style={s.header}><Text style={[s.modalTitle, { color: p.text }]}>Add contribution</Text><Pressable onPress={() => setContributeGoal(null)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
      {contributeGoal ? <Text style={[s.context, { color: p.textMuted }]}>Adding progress to <Text style={{ fontWeight: "800", color: p.text }}>{contributeGoal.name}</Text>. This does not create a spending transaction.</Text> : null}
      <Text style={[s.label, { color: p.text }]}>Amount</Text><TextInput value={contribution} onChangeText={setContribution} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input, s.amount, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
      <Text style={[s.label, { color: p.text }]}>Note (optional)</Text><TextInput value={contributionNote} onChangeText={setContributionNote} placeholder="e.g. March savings" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
      {error ? <Text style={[s.error, { color: p.expense }]}>{error}</Text> : null}<Pressable disabled={saving} onPress={addContribution} style={[s.primary, { backgroundColor: p.primary, opacity: saving ? 0.6 : 1 }]}><Text style={[s.primaryText, { color: p.onPrimary }]}>{saving ? "Saving…" : "Save contribution"}</Text></Pressable>
    </ScrollView></SafeAreaView></KeyboardAvoidingView>
    </Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({ safe: { flex: 1 }, page: { flex: 1, paddingHorizontal: 20, paddingTop: 18 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, title: { fontSize: 29, fontWeight: "800", marginTop: 4 }, add: { paddingHorizontal: 17, paddingVertical: 11, borderRadius: 12 }, addText: { color: "#fff", fontWeight: "700" }, sub: { fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 18 }, card: { borderWidth: 1, borderRadius: 18, padding: 17 }, row: { flexDirection: "row", alignItems: "center", marginBottom: 15 }, cardTitle: { fontSize: 15, fontWeight: "700" }, archive: { fontSize: 12, fontWeight: "700" }, moneyRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }, current: { fontSize: 20, fontWeight: "800" }, track: { height: 8, borderRadius: 8, overflow: "hidden" }, fill: { height: 8, borderRadius: 8 }, contribute: { fontSize: 12, fontWeight: "800" }, empty: { borderWidth: 1, borderRadius: 18, padding: 20 }, primary: { minHeight: 48, padding: 15, borderRadius: 13, alignItems: "center", marginTop: 18 }, primaryText: { color: "#fff", fontWeight: "700" }, modal: { flex: 1 }, form: { padding: 22, paddingBottom: 40 }, modalTitle: { fontSize: 22, fontWeight: "800" }, label: { fontSize: 13, fontWeight: "700", marginTop: 17, marginBottom: 8 }, context: { fontSize: 13, lineHeight: 20, marginTop: 16 }, options: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, option: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 }, amount: { fontSize: 22, fontWeight: "800" }, error: { fontSize: 13, marginTop: 12 } });