import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAccountRepository, type AccountWithBalance } from "@/database/repositories/account-repository";
import { createLoanRepository, type LoanListItem, type LoanPaymentListItem } from "@/database/repositories/loan-repository";
import { toMinorUnits } from "@/domain/money";
import { colors } from "@/theme/colors";
import { ScreenBackButton } from "@/components/ui/screen-back-button";

const makeId = (prefix: string) => prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number, c: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n / 100);

export default function LoansScreen() {
  const db = useSQLiteContext();
  const dark = useColorScheme() === "dark";
  const p = dark ? colors.dark : colors.light;
  const [loans, setLoans] = useState<LoanListItem[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [selected, setSelected] = useState<LoanListItem | null>(null);
  const [payments, setPayments] = useState<LoanPaymentListItem[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [name, setName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [term, setTerm] = useState("12");
  const [interestType, setInterestType] = useState<"flat_rate" | "reducing_balance">("flat_rate");
  const [startDate, setStartDate] = useState(today());
  const [accountId, setAccountId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentNote, setPaymentNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const repo = createLoanRepository(db);
  const load = useCallback(async () => {
    try {
      const [items, acc] = await Promise.all([repo.list(), createAccountRepository(db).list()]);
      setLoans(items); setAccounts(acc);
      setAccountId(v => v || acc[0]?.id || "");
      if (selected) {
        const fresh = items.find(item => item.id === selected.id) ?? null;
        setSelected(fresh);
        if (fresh) setPayments(await repo.listPayments(fresh.id));
      }
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load loans."); }
  }, [db, selected?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const resetForm = () => {
    setName(""); setPrincipal(""); setRate(""); setTerm("12"); setInterestType("flat_rate");
    setStartDate(today()); setAccountId(accounts[0]?.id ?? ""); setError("");
  };

  const openLoan = async (loan: LoanListItem) => {
    setSelected(loan);
    try { setPayments(await repo.listPayments(loan.id)); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load payments."); }
  };

  const saveLoan = async () => {
    setError("");
    if (!/^\d+(\.\d{1,2})?$/.test(principal.trim()) || Number(principal) <= 0) { setError("Enter a positive principal amount."); return; }
    if (!/^\d+(\.\d{1,4})?$/.test(rate.trim()) || Number(rate) < 0) { setError("Enter a valid monthly interest rate."); return; }
    if (!/^\d+$/.test(term.trim()) || Number(term) <= 0) { setError("Enter a positive term in months."); return; }
    try {
      setSaving(true);
      await repo.create({
        id: makeId("loan"), name, principalMinor: toMinorUnits(Number(principal)),
        monthlyInterestRateBps: Math.round(Number(rate) * 100), interestType,
        termMonths: Number(term), startDate, accountId: accountId || null,
      });
      setFormOpen(false); resetForm(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save loan."); } finally { setSaving(false); }
  };

  const savePayment = async () => {
    setError("");
    if (!selected) return;
    if (!/^\d+(\.\d{1,2})?$/.test(paymentAmount.trim()) || Number(paymentAmount) <= 0) { setError("Enter a positive payment amount."); return; }
    try {
      setSaving(true);
      await repo.recordPayment({
        id: makeId("payment"), loanId: selected.id, amountMinor: toMinorUnits(Number(paymentAmount)),
        paymentDate, notes: paymentNote,
      });
      setPaymentOpen(false); setPaymentAmount(""); setPaymentNote(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to record payment."); } finally { setSaving(false); }
  };

  const deleteLoan = (loan: LoanListItem) => Alert.alert(
    "Delete loan and payment history?",
    `“${loan.name}” and all ${payments.length} recorded payment(s) will be permanently deleted, including its financial history. This action cannot be undone.`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete loan", style: "destructive", onPress: async () => {
        try {
          await repo.delete(loan.id);
          setSelected(null);
          setPayments([]);
          await load();
        } catch (e) {
          Alert.alert("Unable to delete loan", e instanceof Error ? e.message : "Please try again.");
        }
      } },
    ],
  );

  const togglePause = async (loan: LoanListItem) => {
    try {
      if (loan.status === "active") await repo.pause(loan.id); else if (loan.status === "paused") await repo.resume(loan.id);
      await load();
    } catch (e) { Alert.alert("Unable to update loan", e instanceof Error ? e.message : "Please try again."); }
  };

  return <SafeAreaView style={[s.safe, { backgroundColor: p.background }]} edges={["top", "left", "right"]}>
    <View style={s.page}>
      <View style={s.header}>
        <ScreenBackButton backgroundColor={p.surface} borderColor={p.border} color={p.text} />
        <View style={{ flex: 1 }}><Text style={{ color: p.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>BORROWING</Text><Text style={[s.title, { color: p.text }]}>Loans</Text></View>
        <Pressable onPress={() => { resetForm(); setFormOpen(true); }} style={[s.add, { backgroundColor: p.primary }]}><Text style={s.addText}>+ Add</Text></Pressable>
      </View>
      <Text style={[s.sub, { color: p.textMuted }]}>Track principal, interest, repayments, and remaining obligation.</Text>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 30 }}>
        {loans.length === 0 ? <View style={[s.empty, { backgroundColor: p.surface, borderColor: p.border }]}><Text style={[s.cardTitle, { color: p.text }]}>No loans yet</Text><Text style={{ color: p.textMuted, marginTop: 6 }}>Add a loan to see its repayment schedule and history.</Text><Pressable onPress={() => { resetForm(); setFormOpen(true); }} style={[s.primary, { backgroundColor: p.primary }]}><Text style={s.primaryText}>Add a loan</Text></Pressable></View> :
        loans.map(loan => <Pressable key={loan.id} onPress={() => void openLoan(loan)} style={[s.card, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={s.row}><View style={{ flex: 1 }}><Text style={[s.cardTitle, { color: p.text }]}>{loan.name}</Text><Text style={{ color: p.textMuted, fontSize: 11, marginTop: 3 }}>{loan.interestType === "flat_rate" ? "Flat rate" : "Reducing balance"} · {loan.termMonths} months</Text></View><Text style={[s.status, { color: loan.status === "paid" ? p.success : loan.status === "paused" ? p.warning : p.primary }]}>{loan.status}</Text></View>
          <View style={s.moneyRow}><Text style={[s.big, { color: p.text }]}>{fmt(loan.remainingMinor, loan.currencyCode)}</Text><Text style={{ color: p.textMuted, fontSize: 11 }}>remaining</Text></View>
          <View style={s.moneyRow}><Text style={{ color: p.textMuted, fontSize: 12 }}>Monthly estimate</Text><Text style={{ color: p.text, fontWeight: "700" }}>{fmt(loan.scheduledPaymentMinor, loan.currencyCode)}</Text></View>
          <View style={s.moneyRow}><Text style={{ color: p.textMuted, fontSize: 12 }}>Total payable</Text><Text style={{ color: p.text, fontWeight: "700" }}>{fmt(loan.totalPayableMinor, loan.currencyCode)}</Text></View>
        </Pressable>)}
      </ScrollView>
    </View>

    <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormOpen(false)}>
      <SafeAreaView style={[s.modal, { backgroundColor: p.background }]}><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <View style={s.header}><Text style={[s.modalTitle, { color: p.text }]}>Add loan</Text><Pressable onPress={() => setFormOpen(false)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
        <Text style={[s.label, { color: p.text }]}>Name</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Car loan" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        <Text style={[s.label, { color: p.text }]}>Principal</Text><TextInput value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input, s.amount, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        <Text style={[s.label, { color: p.text }]}>Monthly interest rate (%)</Text><TextInput value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="e.g. 2" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        <Text style={[s.label, { color: p.text }]}>Term (months)</Text><TextInput value={term} onChangeText={setTerm} keyboardType="number-pad" placeholder="12" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        <Text style={[s.label, { color: p.text }]}>Interest type</Text><View style={s.chips}>{(["flat_rate", "reducing_balance"] as const).map(v => <Pressable key={v} onPress={() => setInterestType(v)} style={[s.chip, { backgroundColor: interestType === v ? p.primary : p.surface, borderColor: interestType === v ? p.primary : p.border }]}><Text style={{ color: interestType === v ? "#fff" : p.text, fontWeight: "700" }}>{v === "flat_rate" ? "Flat rate" : "Reducing balance"}</Text></Pressable>)}</View>
        <Text style={[s.label, { color: p.text }]}>Start date</Text><TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        <Text style={[s.label, { color: p.text }]}>Linked account (optional)</Text><View style={s.options}>{accounts.map(a => <Pressable key={a.id} onPress={() => setAccountId(a.id)} style={[s.option, { backgroundColor: accountId === a.id ? (dark ? "#3A2424" : "#FCE8E8") : p.surface, borderColor: accountId === a.id ? p.primary : p.border }]}><Text style={{ color: accountId === a.id ? p.primary : p.text, fontWeight: "600" }}>{a.name} · {a.currencyCode}</Text></Pressable>)}</View>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable disabled={saving} onPress={() => void saveLoan()} style={[s.primary, { backgroundColor: p.primary, opacity: saving ? 0.6 : 1 }]}><Text style={s.primaryText}>{saving ? "Saving…" : "Save loan"}</Text></Pressable>
      </ScrollView></SafeAreaView>
    </Modal>

    <Modal visible={selected !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
      <SafeAreaView style={[s.modal, { backgroundColor: p.background }]} edges={["top", "left", "right"]}>
        {selected ? <ScrollView contentContainerStyle={s.form}>
          <View style={s.header}><View><Text style={[s.modalTitle, { color: p.text }]}>{selected.name}</Text><Text style={{ color: p.textMuted, marginTop: 4 }}>{selected.status} · due {selected.dueDate}</Text></View><Pressable onPress={() => setSelected(null)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
          <View style={[s.summary, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Text style={{ color: p.textMuted, fontSize: 12 }}>Remaining obligation</Text><Text style={[s.hero, { color: p.text }]}>{fmt(selected.remainingMinor, selected.currencyCode)}</Text>
            <View style={s.moneyRow}><Text style={{ color: p.textMuted }}>Monthly estimate</Text><Text style={{ color: p.text, fontWeight: "700" }}>{fmt(selected.scheduledPaymentMinor, selected.currencyCode)}</Text></View>
            <View style={s.moneyRow}><Text style={{ color: p.textMuted }}>Interest</Text><Text style={{ color: p.text, fontWeight: "700" }}>{fmt(selected.totalInterestMinor, selected.currencyCode)}</Text></View>
          </View>
          <Pressable disabled={selected.status === "paid"} onPress={() => { setPaymentDate(today()); setPaymentAmount(""); setPaymentNote(""); setError(""); setPaymentOpen(true); }} style={[s.primary, { backgroundColor: p.primary, opacity: selected.status === "paid" ? 0.5 : 1 }]}><Text style={s.primaryText}>Record payment</Text></Pressable>
          {selected.status !== "paid" ? <Pressable onPress={() => void togglePause(selected)} style={[s.secondary, { borderColor: p.border }]}><Text style={{ color: p.text, fontWeight: "700" }}>{selected.status === "active" ? "Pause loan" : "Resume loan"}</Text></Pressable> : null}
          <Pressable onPress={() => deleteLoan(selected)} style={s.dangerButton}><Text style={s.dangerText}>Delete loan and history</Text></Pressable>
          <Text style={[s.section, { color: p.text }]}>Payment history</Text>
          {payments.length === 0 ? <Text style={{ color: p.textMuted }}>No payments recorded yet.</Text> : payments.map(payment => <View key={payment.id} style={[s.payment, { backgroundColor: p.surface, borderColor: p.border }]}>
            <View style={s.row}><View style={{ flex: 1 }}><Text style={[s.cardTitle, { color: p.text }]}>{fmt(payment.amountMinor, selected.currencyCode)}</Text><Text style={{ color: p.textMuted, fontSize: 11, marginTop: 3 }}>{payment.paymentDate}</Text></View><Text style={{ color: p.textMuted, fontSize: 11 }}>Interest {fmt(payment.interestPaidMinor, selected.currencyCode)}</Text></View>
            <Text style={{ color: p.textMuted, fontSize: 11, marginTop: 5 }}>Principal {fmt(payment.principalPaidMinor, selected.currencyCode)}{payment.notes ? " · " + payment.notes : ""}</Text>
          </View>)}
        </ScrollView> : null}
      </SafeAreaView>
    </Modal>

    <Modal visible={paymentOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPaymentOpen(false)}>
      <SafeAreaView style={[s.modal, { backgroundColor: p.background }]}><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <View style={s.header}><Text style={[s.modalTitle, { color: p.text }]}>Record payment</Text><Pressable onPress={() => setPaymentOpen(false)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
        <Text style={[s.label, { color: p.text }]}>Amount</Text><TextInput value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input, s.amount, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        <Text style={[s.label, { color: p.text }]}>Payment date</Text><TextInput value={paymentDate} onChangeText={setPaymentDate} placeholder="YYYY-MM-DD" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        <Text style={[s.label, { color: p.text }]}>Note (optional)</Text><TextInput value={paymentNote} onChangeText={setPaymentNote} placeholder="Optional note" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable disabled={saving} onPress={() => void savePayment()} style={[s.primary, { backgroundColor: p.primary, opacity: saving ? 0.6 : 1 }]}><Text style={s.primaryText}>{saving ? "Saving…" : "Save payment"}</Text></Pressable>
      </ScrollView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1 }, page: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontSize: 29, fontWeight: "800", marginTop: 4 }, add: { paddingHorizontal: 17, paddingVertical: 11, borderRadius: 12 },
  addText: { color: "#fff", fontWeight: "700" }, sub: { fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 18 },
  card: { borderWidth: 1, borderRadius: 18, padding: 17 }, row: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "700" }, status: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  moneyRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 9 },
  big: { fontSize: 21, fontWeight: "800" }, empty: { borderWidth: 1, borderRadius: 18, padding: 20 },
  primary: { padding: 15, borderRadius: 13, alignItems: "center", marginTop: 18 }, primaryText: { color: "#fff", fontWeight: "700" },
  secondary: { padding: 14, borderWidth: 1, borderRadius: 13, alignItems: "center", marginTop: 10 },
  dangerButton: { padding: 14, alignItems: "center", marginTop: 8 }, dangerText: { color: "#D32F2F", fontWeight: "700" },
  modal: { flex: 1 }, form: { padding: 22, paddingBottom: 40 }, modalTitle: { fontSize: 22, fontWeight: "800" },
  label: { fontSize: 13, fontWeight: "700", marginTop: 17, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  amount: { fontSize: 22, fontWeight: "800" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 10 }, options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, error: { color: "#D32F2F", fontSize: 13, marginTop: 12 },
  summary: { borderWidth: 1, borderRadius: 18, padding: 17, marginTop: 18 }, hero: { fontSize: 30, fontWeight: "800", marginTop: 5 },
  section: { fontSize: 17, fontWeight: "800", marginTop: 26, marginBottom: 10 }, payment: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8 },
});
