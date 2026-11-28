import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { todayLocalDate } from "@/domain/dates";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createHistoryRepository, type HistoryFilter, type HistoryItem } from "@/database/repositories/history-repository";
import { createTransactionRepository, isLinkedTransactionId, type TransactionListItem } from "@/database/repositories/transaction-repository";
import { createAccountRepository, type AccountWithBalance } from "@/database/repositories/account-repository";
import { historyAmountPrefix, historyKindLabel } from "@/domain/history";
import { getTransferDestinationAccountId } from "@/domain/accounts";
import { toMinorUnits } from "@/domain/money";
import { colors } from "@/theme/colors";
import { SelectField, type SelectOption } from "@/components/ui/select-field";
import { DateField } from "@/components/ui/date-field";

const fmt = (n: number, c: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n / 100);
const makeId = (prefix: string) => prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
const today = todayLocalDate;

type FormKind = "income" | "expense" | "transfer" | "loan" | "savings";
const kindLabel: Record<FormKind, string> = { income: "Income", expense: "Expense", transfer: "Transfer", loan: "Loans", savings: "Savings" };

function transactionKind(item: TransactionListItem): FormKind {
  if (item.type === "transfer") return "transfer";
  if (item.categoryId === "cat-income-loan") return "loan";
  if (item.categoryId === "cat-expense-savings") return "savings";
  return item.type;
}

function KindSelector({ value, onChange, palette }: { value: FormKind; onChange: (value: FormKind) => void; palette: typeof colors.light }) {
  return <View style={s.kindRow}>{(Object.keys(kindLabel) as FormKind[]).map(kind => (
    <Pressable key={kind} onPress={() => onChange(kind)} style={[s.kindChip, { backgroundColor: value === kind ? palette.primary : palette.surface, borderColor: value === kind ? palette.primary : palette.border }]}>
      <Text style={{ color: value === kind ? "#fff" : palette.text, fontSize: 11, fontWeight: "800" }}>{kindLabel[kind]}</Text>
    </Pressable>
  ))}</View>;
}

export default function TransactionsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const dark = useColorScheme() === "dark";
  const p = dark ? colors.dark : colors.light;
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [editing, setEditing] = useState<TransactionListItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [accountName, setAccountName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [formKind, setFormKind] = useState<FormKind>("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(today());
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [showNote, setShowNote] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const historyRepo = useMemo(() => createHistoryRepository(db), [db]);
  const txRepo = useMemo(() => createTransactionRepository(db), [db]);
  const accountRepo = useMemo(() => createAccountRepository(db), [db]);

  const load = useCallback(async () => {
    try {
      const [history, acc] = await Promise.all([historyRepo.list({ filter, search, fromDate: fromDate || undefined, toDate: toDate || undefined, accountName: accountName || undefined, categoryName: categoryName || undefined }), accountRepo.list()]);
      const activeAccounts = acc.filter(a => !a.isArchived);
      const activeAccountIds = activeAccounts.map(account => account.id);
      const sourceAccountId = activeAccountIds.includes(accountId)
        ? accountId
        : activeAccountIds[0] ?? "";

      setItems(history);
      setAccounts(activeAccounts);
      setAccountId(sourceAccountId);
      setDestinationAccountId(current =>
        getTransferDestinationAccountId(activeAccountIds, sourceAccountId, current),
      );
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load activity."); }
  }, [historyRepo, txRepo, accountRepo, filter, search, fromDate, toDate, accountName, categoryName, accountId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const accountOptions = accounts.map(a => ({ value: a.id, label: a.name, description: a.currencyCode + " · " + fmt(a.balanceMinor, a.currencyCode) }));
  const categoryOptions = categories;
  const loadCategories = useCallback(async (kind: FormKind) => {
    if (kind === "transfer") { setCategories([]); setCategoryId(""); return; }
    const actualType = kind === "loan" ? "income" : kind === "savings" ? "expense" : kind;
    const rows = await txRepo.listCategories(actualType);
    setCategories(rows.map(row => ({ value: row.id, label: row.name })));
    const preferred = kind === "loan" ? "cat-income-loan" : kind === "savings" ? "cat-expense-savings" : "";
    setCategoryId(current => rows.some(row => row.id === current) ? current : rows.some(row => row.id === preferred) ? preferred : rows[0]?.id ?? "");
    setName(current => current.trim() ? current : (rows.find(row => row.id === preferred)?.name ?? rows[0]?.name ?? ""));
  }, [txRepo]);

  const resetForm = () => {
    setEditing(null); setFormKind("expense"); setName(""); setAmount(""); setAccountId(accounts[0]?.id ?? "");
    setDestinationAccountId(accounts.find(a => a.id !== accounts[0]?.id)?.id ?? ""); setCategoryId(""); setNote(""); setShowNote(false); setOccurredAt(today()); setError("");
    void loadCategories("expense");
  };
  const openEdit = async (item: HistoryItem) => {
    const historyTransactionKind = item.kind === "income"
      ? "income"
      : item.kind === "expense"
        ? "expense"
        : item.kind === "transfer"
          ? "transfer"
          : null;
    if (!historyTransactionKind) return;
    if (isLinkedTransactionId(item.id)) return;
    const transaction = await txRepo.getForHistory(item.id, historyTransactionKind);
    if (!transaction) {
      Alert.alert("Unable to edit", "This transaction is no longer available.");
      return;
    }
    setEditing(transaction); setFormKind(transactionKind(transaction)); setName(transaction.description); setAmount((transaction.amountMinor / 100).toFixed(2));
    setAccountId(transaction.accountId);
    if (transaction.transferGroupId) {
      const destination = await db.getFirstAsync<{ account_id: string }>(
        "SELECT account_id FROM transactions WHERE transfer_group_id = ? AND transfer_direction = 'in' AND deleted_at IS NULL",
        transaction.transferGroupId,
      );
      setDestinationAccountId(destination?.account_id ?? "");
    } else {
      setDestinationAccountId("");
    }
    setCategoryId(transaction.categoryId ?? ""); setNote(transaction.notes ?? ""); setOccurredAt(transaction.occurredAt.slice(0, 10)); setError("");
    await loadCategories(transactionKind(transaction)); setFormOpen(true);
  };
  const remove = (item: HistoryItem) => {
    const historyTransactionKind = item.kind === "income"
      ? "income"
      : item.kind === "expense"
        ? "expense"
        : item.kind === "transfer"
          ? "transfer"
          : null;
    if (!historyTransactionKind) return;
    if (isLinkedTransactionId(item.id)) return;
    Alert.alert(
      item.kind === "transfer" ? "Delete transfer?" : "Delete transaction?",
      item.kind === "transfer" ? "Both sides of this transfer will be deleted from account balances and activity." : "This transaction will be removed from balances and activity. The action will be recorded in the Activity Log.",
      [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const transaction = await txRepo.getForHistory(item.id, historyTransactionKind);
          if (!transaction) throw new Error("This transaction is no longer available.");
          await txRepo.delete(transaction.id);
          await load();
        } catch (e) { Alert.alert("Unable to delete", e instanceof Error ? e.message : "Please try again."); }
      } }],
    );
  };
  const save = async () => {
    setError("");
    if (!name.trim()) { setError("Enter a transaction name."); return; }
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) { setError("Enter a positive amount."); return; }
    if (!accountId) { setError("Choose an account."); return; }
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const amountMinor = toMinorUnits(Number(amount));
      if (formKind === "transfer") {
        if (!destinationAccountId || destinationAccountId === accountId) { setError("Choose a different destination account."); return; }
        if (editing) await txRepo.updateTransfer(editing.id, { sourceAccountId: accountId, destinationAccountId, amountMinor, description: name, notes: note, occurredAt });
        else await txRepo.createTransfer({ groupId: makeId("transfer"), sourceAccountId: accountId, destinationAccountId, amountMinor, description: name, notes: note, occurredAt });
      } else {
        const actualType = formKind === "loan" ? "income" : formKind === "savings" ? "expense" : formKind;
        const actualCategory = formKind === "loan" ? "cat-income-loan" : formKind === "savings" ? "cat-expense-savings" : categoryId;
        if (!actualCategory) { setError("Choose a category."); return; }
        if (editing) await txRepo.update(editing.id, { accountId, categoryId: actualCategory, type: actualType, amountMinor, description: name, notes: note, occurredAt });
        else await txRepo.create({ id: makeId("transaction"), accountId, categoryId: actualCategory, type: actualType, amountMinor, description: name, notes: note, occurredAt });
      }
      setFormOpen(false); resetForm(); await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save transaction.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const openNew = async () => { resetForm(); try { const recent = await txRepo.listRecent(1); const recentAccountId = recent[0]?.accountId; if (recentAccountId && accounts.some(account => account.id === recentAccountId)) setAccountId(recentAccountId); } catch {} setFormOpen(true); };
  const { quick } = useLocalSearchParams<{ quick?: string }>();
  useFocusEffect(useCallback(() => {
    if (quick === "expense") {
      void openNew();
      router.setParams({ quick: undefined });
    }
  }, [quick, router]));

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: p.background }]} edges={["top", "left", "right"]}>
      <View style={s.page}>
        <View style={s.header}>
          <View><Text style={{ color: p.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>FINANCIAL HISTORY</Text><Text style={[s.title, { color: p.text }]}>Activity</Text></View>
          <Pressable onPress={openNew} style={[s.add, { backgroundColor: p.primary }]}><MaterialCommunityIcons name="plus" size={18} color="#fff" /><Text style={s.addText}>Add</Text></Pressable>
        </View>
        <Text style={[s.sub, { color: p.textMuted }]}>Create and manage transactions, while keeping loans, subscriptions, and savings activity in the same history.</Text>

        <View style={[s.searchBox, { backgroundColor: p.surface, borderColor: p.border }]}><TextInput value={search} onChangeText={setSearch} placeholder="Search activity" placeholderTextColor={p.textMuted} style={[s.searchInput, { color: p.text }]} />{search || fromDate || toDate || accountName || categoryName || filter !== "all" ? <Pressable onPress={() => { setFilter("all"); setSearch(""); setFromDate(""); setToDate(""); setAccountName(""); setCategoryName(""); }}><Text style={{ color: p.primary, fontWeight: "700", fontSize: 12 }}>Clear</Text></Pressable> : null}</View>
        <Pressable onPress={() => setShowFilters(value => !value)} style={[s.filtersToggle, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={s.filtersToggleLabel}>
            <MaterialCommunityIcons name="tune-variant" size={16} color={p.primary} />
            <Text style={{ color: p.text, fontSize: 12, fontWeight: "800" }}>Filters</Text>
            {(fromDate || toDate || accountName || categoryName || filter !== "all") ? <View style={[s.filterBadge, { backgroundColor: p.primary }]}><Text style={s.filterBadgeText}>Active</Text></View> : null}
          </View>
          <MaterialCommunityIcons name={showFilters ? "chevron-up" : "chevron-down"} size={18} color={p.textMuted} />
        </Pressable>
        {showFilters ? <>
          <View style={s.filters}>{(["all", "income", "expense", "transfer", "loan", "subscription", "savings"] as HistoryFilter[]).map(kind => <Pressable key={kind} onPress={() => setFilter(kind)} style={[s.filter, { backgroundColor: filter === kind ? p.primary : p.surface, borderColor: filter === kind ? p.primary : p.border }]}><Text style={{ color: filter === kind ? "#fff" : p.text, fontWeight: "700", fontSize: 11 }}>{historyKindLabel(kind)}</Text></Pressable>)}</View>
          <View style={s.dateRow}><View style={{ flex: 1 }}><DateField label="From" value={fromDate} onChange={setFromDate} placeholder="Any date" /></View><View style={{ flex: 1 }}><DateField label="To" value={toDate} onChange={setToDate} placeholder="Any date" /></View></View>
          <View style={s.dateRow}><TextInput value={accountName} onChangeText={setAccountName} placeholder="Account name" placeholderTextColor={p.textMuted} style={[s.filterInput, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} /><TextInput value={categoryName} onChangeText={setCategoryName} placeholder="Category name" placeholderTextColor={p.textMuted} style={[s.filterInput, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} /></View>
        </> : null>

        {error ? <View style={[s.error, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}><Text style={{ color: p.expense, fontWeight: "800", fontSize: 12 }}>{error}</Text></View> : null}
        <ScrollView contentContainerStyle={s.list}>
          {items.length === 0 ? <View style={[s.empty, { backgroundColor: p.surface, borderColor: p.border }]}><MaterialCommunityIcons name="receipt-text-outline" size={34} color={p.primary}/><Text style={[s.itemTitle, { color: p.text, marginTop: 10 }]}>No activity found</Text><Text style={{ color: p.textMuted, fontSize: 13, marginTop: 6, textAlign: "center" }}>Try a different filter, or add your first transaction.</Text><Pressable onPress={openNew} style={[s.primaryButton, { backgroundColor: p.primary }]}><Text style={s.primaryButtonText}>Add transaction</Text></Pressable></View> :
          items.map(item => {
            const prefix = historyAmountPrefix(item.kind);
            const editable = (item.kind === "income" || item.kind === "expense" || item.kind === "transfer") && !isLinkedTransactionId(item.id);
            return <Pressable key={item.kind + "-" + item.id} onPress={() => setSelected(item)} style={[s.card, { backgroundColor: p.surface, borderColor: p.border }]}>
              <View style={s.itemRow}><View style={[s.dot, { backgroundColor: kindColor(item.kind, p) }]} /><View style={{ flex: 1 }}><Text style={[s.itemTitle, { color: p.text }]} numberOfLines={1}>{item.title}</Text><Text style={{ color: p.textMuted, fontSize: 11, marginTop: 4 }} numberOfLines={1}>{historyKindLabel(item.kind)} · {item.subtitle}</Text></View><Text style={{ fontWeight: "800", fontSize: 12, color: item.kind === "income" ? p.income : item.kind === "expense" ? p.expense : p.text }}>{prefix}{fmt(item.amountMinor, item.currencyCode)}</Text></View>
              <View style={s.bottom}><Text style={{ color: p.textMuted, fontSize: 11 }}>{item.occurredAt.slice(0,10)}</Text><Text style={{ color: p.textMuted, fontSize: 11 }}>{item.accountName ?? "No account"}</Text></View>
              {editable ? <View style={s.rowActions}><Pressable onPress={() => void openEdit(item)} hitSlop={8}><Text style={{ color: p.primary, fontSize: 11, fontWeight: "800" }}>Edit</Text></Pressable><Pressable onPress={() => remove(item)} hitSlop={8}><Text style={{ color: p.expense, fontSize: 11, fontWeight: "800" }}>Delete</Text></Pressable></View> : null}
            </Pressable>;
          })}
        </ScrollView>
      </View>

      <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormOpen(false)}>
        <SafeAreaView style={[s.modal, { backgroundColor: p.background }]} edges={["top","left","right"]}>
          <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
            <View style={s.header}><View style={{ flex: 1 }}><Text style={[s.modalTitle, { color: p.text }]}>{editing ? "Edit transaction" : "Add transaction"}</Text><Text style={{ color: p.textMuted, fontSize: 12, marginTop: 3 }}>{editing ? "Update the linked account, amount, category, or date." : "Record money moving in, out, or between accounts."}</Text></View><Pressable onPress={() => setFormOpen(false)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
            <Text style={[s.label, { color: p.text }]}>Transaction type</Text>
            <KindSelector value={formKind} onChange={kind => { setFormKind(kind); setEditing(formKind === kind ? editing : editing && transactionKind(editing) === kind ? editing : null); void loadCategories(kind); }} palette={p} />
            {formKind === "transfer" ? <>
              <SelectField label="From account" required value={accountId} options={accountOptions} onChange={value => { setAccountId(value); setDestinationAccountId(current => getTransferDestinationAccountId(accounts.map(account => account.id), value, current)); }} placeholder="Select source account" />
              <SelectField label="To account" required value={destinationAccountId} options={accountOptions.filter(o => o.value !== accountId)} onChange={setDestinationAccountId} placeholder="Select destination account" />
              <Text style={[s.label, { color: p.text }]}>Amount *</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input, s.amount, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
              <Text style={[s.label, { color: p.text }]}>Transaction name *</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Move money" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
              <DateField label="Date" required value={occurredAt} onChange={setOccurredAt} />
              <Pressable onPress={() => setShowNote(v => !v)} style={s.noteToggle}><MaterialCommunityIcons name={showNote ? "minus-circle-outline" : "plus-circle-outline"} size={18} color={p.primary} /><Text style={{color:p.primary,fontSize:12,fontWeight:"800"}}>{showNote ? "Hide note" : "Add note"}{showNote ? "" : " (optional)"}</Text></Pressable>
              {showNote ? <TextInput value={note} onChangeText={setNote} placeholder="Optional note" placeholderTextColor={p.textMuted} style={[s.input, {color:p.text,backgroundColor:p.surface,borderColor:p.border}]} /> : null}
            </> : <>
              <Text style={[s.label, { color: p.text }]}>Amount *</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input, s.amount, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
              <View style={s.quickAmounts}>{[50,100,200,500].map(value=><Pressable key={value} onPress={()=>setAmount(current=>String((Number(current)||0)+value))} style={[s.quickChip,{backgroundColor:p.surface,borderColor:p.border}]}><Text style={{color:p.primary,fontWeight:"800",fontSize:12}}>+{value}</Text></Pressable>)}</View>
              <Text style={[s.label,{color:p.text}]}>Category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryScroll}>{categoryOptions.slice(0,9).map(option=><Pressable key={option.value} onPress={()=>{setCategoryId(option.value);if(!name.trim())setName(option.label)}} style={[s.categoryChip,{backgroundColor:categoryId===option.value?p.primary:p.surface,borderColor:categoryId===option.value?p.primary:p.border}]}><Text numberOfLines={1} style={{color:categoryId===option.value?"#fff":p.text,fontSize:12,fontWeight:"700"}}>{option.label}</Text></Pressable>)}</ScrollView>
              <View style={s.compactRow}><View style={{flex:1}}><SelectField label="Account" required value={accountId} options={accountOptions} onChange={setAccountId} placeholder="Account" /></View><View style={{flex:1}}><DateField label="Date" required value={occurredAt} onChange={setOccurredAt} /></View></View>
              <Text style={[s.label,{color:p.text}]}>Transaction name</Text><TextInput value={name} onChangeText={setName} placeholder="Auto-filled from category" placeholderTextColor={p.textMuted} style={[s.input,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]} />
              <Pressable onPress={()=>setShowNote(v=>!v)} style={s.noteToggle}><MaterialCommunityIcons name={showNote?"minus-circle-outline":"plus-circle-outline"} size={18} color={p.primary}/><Text style={{color:p.primary,fontSize:12,fontWeight:"800"}}>{showNote?"Hide note":"Add note"}{showNote?"":" (optional)"}</Text></Pressable>
              {showNote ? <TextInput value={note} onChangeText={setNote} placeholder="Optional note" placeholderTextColor={p.textMuted} style={[s.input,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]} /> : null}
            </>}
            {error ? <Text style={s.errorText}>{error}</Text> : null}
            <Pressable disabled={saving} onPress={() => void save()} style={[s.primaryButton, { backgroundColor: p.primary, opacity: saving ? 0.65 : 1 }]}><Text style={s.primaryButtonText}>{saving ? "Saving…" : editing ? "Save changes" : "Save transaction"}</Text></Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={selected !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={[s.modal, { backgroundColor: p.background }]} edges={["top","left","right"]}>
          {selected ? <ScrollView contentContainerStyle={s.detail}>
            <View style={s.header}><View style={{ flex: 1 }}><Text style={{ color: p.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>{historyKindLabel(selected.kind).toUpperCase()}</Text><Text style={[s.modalTitle, { color: p.text }]}>{selected.title}</Text></View><Pressable onPress={() => setSelected(null)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
            <View style={[s.detailCard, { backgroundColor: p.surface, borderColor: p.border }]}>
              <Text style={{ color: p.textMuted, fontSize: 12 }}>Amount</Text><Text style={[s.hero, { color: selected.kind === "income" ? p.income : selected.kind === "expense" ? p.expense : p.text }]}>{historyAmountPrefix(selected.kind)}{fmt(selected.amountMinor, selected.currencyCode)}</Text>
              <DetailRow label="Date" value={selected.occurredAt.slice(0,10)} color={p.text} muted={p.textMuted}/><DetailRow label="Account" value={selected.accountName ?? "No account"} color={p.text} muted={p.textMuted}/><DetailRow label="Category" value={selected.categoryName ?? "—"} color={p.text} muted={p.textMuted}/><DetailRow label="Details" value={selected.subtitle} color={p.text} muted={p.textMuted}/>
              {selected.interestPaidMinor !== null ? <DetailRow label="Interest" value={fmt(selected.interestPaidMinor, selected.currencyCode)} color={p.text} muted={p.textMuted}/> : null}
              {selected.principalPaidMinor !== null ? <DetailRow label="Principal" value={fmt(selected.principalPaidMinor, selected.currencyCode)} color={p.text} muted={p.textMuted}/> : null}
            </View>
            {selected.notes ? <View style={[s.noteCard,{backgroundColor:p.surface,borderColor:p.border}]}><Text style={{color:p.textMuted,fontSize:12}}>Note</Text><Text style={{color:p.text,fontSize:13,lineHeight:20,marginTop:6}}>{selected.notes}</Text></View>:null}
          </ScrollView> : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function kindColor(kind: HistoryItem["kind"], palette: typeof colors.light) {
  if (kind === "income") return palette.income;
  if (kind === "expense") return palette.expense;
  if (kind === "transfer") return palette.primary;
  return palette.secondary;
}
function DetailRow({ label, value, color, muted }: { label: string; value: string; color: string; muted: string }) {
  return <View style={s.detailRow}><Text style={{ color: muted, fontSize: 12 }}>{label}</Text><Text style={{ color, fontSize: 13, fontWeight: "700", textAlign: "right", flexShrink: 1 }}>{value}</Text></View>;
}
const s = StyleSheet.create({
  safe:{flex:1},page:{flex:1,paddingHorizontal:20,paddingTop:18},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},
  title:{fontSize:29,fontWeight:"800",marginTop:4},add:{flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:15,paddingVertical:11,borderRadius:12},addText:{color:"#fff",fontWeight:"700"},
  sub:{fontSize:14,lineHeight:21,marginTop:8,marginBottom:15},filters:{flexDirection:"row",flexWrap:"wrap",gap:6,paddingBottom:8},filter:{borderWidth:1,borderRadius:16,paddingHorizontal:10,paddingVertical:7},
  searchBox:{minHeight:46,borderWidth:1,borderRadius:13,flexDirection:"row",alignItems:"center",paddingHorizontal:13},searchInput:{flex:1,paddingVertical:10,fontSize:13},
  dateRow:{flexDirection:"row",gap:8}, compactRow:{flexDirection:"row",gap:8,alignItems:"flex-start"}, quickAmounts:{flexDirection:"row",gap:8,marginTop:8}, quickChip:{borderWidth:1,borderRadius:18,paddingHorizontal:14,paddingVertical:9}, categoryScroll:{gap:8,paddingVertical:2}, categoryChip:{borderWidth:1,borderRadius:18,paddingHorizontal:13,paddingVertical:9,maxWidth:130}, noteToggle:{flexDirection:"row",alignItems:"center",gap:7,marginTop:15,paddingVertical:4},filterInput:{flex:1,borderWidth:1,borderRadius:12,paddingHorizontal:12,paddingVertical:10,fontSize:11,marginTop:8},
  list:{gap:10,paddingTop:10,paddingBottom:40},card:{borderWidth:1,borderRadius:16,padding:14},itemRow:{flexDirection:"row",alignItems:"center",gap:10},dot:{width:9,height:9,borderRadius:5},
  itemTitle:{fontSize:14,fontWeight:"700"},bottom:{flexDirection:"row",justifyContent:"space-between",gap:10,marginTop:12},rowActions:{flexDirection:"row",justifyContent:"flex-end",gap:18,marginTop:12,paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:"rgba(100,116,139,0.18)"},
  empty:{borderWidth:1,borderRadius:16,padding:22,marginTop:12,alignItems:"center"},primaryButton:{minHeight:48,borderRadius:13,alignItems:"center",justifyContent:"center",paddingHorizontal:16,marginTop:16},primaryButtonText:{color:"#fff",fontSize:13,fontWeight:"800"},
  error:{borderRadius:14,padding:12,marginTop:8},errorText:{color:"#D32F2F",fontSize:13,marginTop:12},modal:{flex:1},form:{padding:22,paddingBottom:48},modalTitle:{fontSize:23,fontWeight:"900"},
  label:{fontSize:13,fontWeight:"700",marginTop:17,marginBottom:8},kindRow:{flexDirection:"row",flexWrap:"wrap",gap:7},kindChip:{borderWidth:1,borderRadius:20,paddingHorizontal:10,paddingVertical:9},
  input:{borderWidth:1,borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:14},amount:{fontSize:22,fontWeight:"800"},detail:{padding:22,paddingBottom:48},detailCard:{borderWidth:1,borderRadius:18,padding:18,marginTop:18},hero:{fontSize:30,fontWeight:"800",marginTop:7,marginBottom:16},
  detailRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:16,paddingVertical:9,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:"rgba(100,116,139,0.18)"},noteCard:{borderWidth:1,borderRadius:16,padding:16,marginTop:10},
});