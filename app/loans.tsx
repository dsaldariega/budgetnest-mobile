import { useAppTheme } from "@/theme/use-app-theme";
import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAccountRepository, type AccountWithBalance } from "@/database/repositories/account-repository";
import { createLoanRepository, type LoanListItem, type LoanPaymentListItem } from "@/database/repositories/loan-repository";
import { toMinorUnits } from "@/domain/money";
import { compareDates, todayLocalDate } from "@/domain/dates";
import { colors } from "@/theme/colors";
import { ScreenBackButton } from "@/components/ui/screen-back-button";
import { SelectField } from "@/components/ui/select-field";
import { DateField } from "@/components/ui/date-field";

const makeId = (prefix: string) => prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
const today = todayLocalDate;
const fmt = (n: number, c: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n / 100);

function termMonths(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  let months = (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth();
  if (e.getDate() < s.getDate()) months -= 1;
  return Math.max(1, months);
}

export default function LoansScreen() {
  const db = useSQLiteContext();
  const { isDark: dark, palette: p } = useAppTheme();
  const [loans, setLoans] = useState<LoanListItem[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [selected, setSelected] = useState<LoanListItem | null>(null);
  const [payments, setPayments] = useState<LoanPaymentListItem[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editing, setEditing] = useState<LoanListItem | null>(null);
  const [name, setName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentNote, setPaymentNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [items, acc] = await Promise.all([createLoanRepository(db).list(), createAccountRepository(db).list()]);
      setLoans(Array.isArray(items) ? items : []); setAccounts((Array.isArray(acc) ? acc : []).filter(a => !a.isArchived));
      setAccountId(v => v || acc.find(a => !a.isArchived)?.id || "");
      if (selected) {
        const fresh = items.find(item => item.id === selected.id) ?? null;
        setSelected(fresh);
        if (fresh) setPayments(await createLoanRepository(db).listPayments(fresh.id));
      }
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load loans."); }
  }, [db, selected?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const resetForm = () => {
    setEditing(null); setName(""); setPrincipal(""); setRate(""); setStartDate(today()); setEndDate(""); setAccountId(accounts[0]?.id ?? ""); setError("");
  };

  const openEdit = (loan: LoanListItem) => {
    setEditing(loan); setName(loan.name); setPrincipal((loan.principalMinor / 100).toFixed(2));
    setRate((loan.monthlyInterestRateBps / 100).toFixed(2)); setStartDate(loan.startDate); setEndDate(loan.dueDate);
    setAccountId(loan.accountId ?? ""); setError(""); setFormOpen(true);
  };

  const openLoan = async (loan: LoanListItem) => {
    setSelected(loan);
    try { setPayments(await createLoanRepository(db).listPayments(loan.id)); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load payments."); }
  };

  const saveLoan = async () => {
    setError("");
    if (!name.trim()) { setError("Enter a loan name or description."); return; }
    if (!/^\d+(\.\d{1,2})?$/.test(principal.trim()) || Number(principal) <= 0) { setError("Enter a positive principal amount."); return; }
    if (!/^\d+(\.\d{1,4})?$/.test(rate.trim()) || Number(rate) < 0) { setError("Enter a valid monthly interest rate."); return; }
    if (!accountId) { setError("Choose a linked account."); return; }
    if (!endDate) { setError("Choose an end date."); return; }
    try {
      if (compareDates(endDate, startDate) <= 0) { setError("End date must be after the start date."); return; }
      setSaving(true);
      const payload = {
        id: editing?.id ?? makeId("loan"), name, principalMinor: toMinorUnits(Number(principal)),
        monthlyInterestRateBps: Math.round(Number(rate) * 100), interestType: "flat_rate" as const,
        termMonths: termMonths(startDate, endDate), startDate, dueDate: endDate, accountId,
      };
      if (editing) await createLoanRepository(db).update(payload);
      else await createLoanRepository(db).create(payload);
      setFormOpen(false); resetForm(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save loan."); } finally { setSaving(false); }
  };

  const savePayment = async () => {
    setError("");
    if (!selected) return;
    if (!selected.accountId) { setError("Edit this loan first and choose a linked account."); return; }
    if (!/^\d+(\.\d{1,2})?$/.test(paymentAmount.trim()) || Number(paymentAmount) <= 0) { setError("Enter a positive payment amount."); return; }
    try {
      setSaving(true);
      await createLoanRepository(db).recordPayment({ id: makeId("payment"), loanId: selected.id, amountMinor: toMinorUnits(Number(paymentAmount)), paymentDate, notes: paymentNote });
      setPaymentOpen(false); setPaymentAmount(""); setPaymentNote(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to record payment."); } finally { setSaving(false); }
  };

  const deleteLoan = (loan: LoanListItem) => Alert.alert(
    "Delete loan and payment history?",
    "The loan, its payment history, and linked financial transactions will be permanently deleted from the active records. This cannot be undone.",
    [{ text: "Cancel", style: "cancel" }, { text: "Delete loan", style: "destructive", onPress: async () => {
      try { await createLoanRepository(db).delete(loan.id); setSelected(null); setPayments([]); await load(); }
      catch (e) { Alert.alert("Unable to delete loan", e instanceof Error ? e.message : "Please try again."); }
    }}],
  );

  const togglePause = async (loan: LoanListItem) => {
    try { if (loan.status === "active") await createLoanRepository(db).pause(loan.id); else if (loan.status === "paused") await createLoanRepository(db).resume(loan.id); await load(); }
    catch (e) { Alert.alert("Unable to update loan", e instanceof Error ? e.message : "Please try again."); }
  };

  const accountOptions = (accounts ?? []).map(a => ({ value: a.id, label: a.name, description: a.currencyCode + " · " + fmt(a.balanceMinor, a.currencyCode) }));

  return <SafeAreaView style={[s.safe, { backgroundColor: p.background }]} edges={["top", "left", "right"]}>
    <View style={s.page}>
      <View style={s.header}>
        <ScreenBackButton backgroundColor={p.surface} borderColor={p.border} color={p.text} />
        <View style={{ flex: 1 }}><Text style={{ color: p.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>BORROWING</Text><Text style={[s.title, { color: p.text }]}>Loans</Text></View>
        {loans.length > 0 ? <Pressable onPress={() => { resetForm(); setFormOpen(true); }} style={[s.add, { backgroundColor: p.primary }]}><Text style={[s.addText, { color: p.onPrimary }]}>+ Add</Text></Pressable> : null}
      </View>
      <Text style={[s.sub, { color: p.textMuted }]}>Track flat-rate loans, repayments, and the account receiving the loan proceeds.</Text>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 30 }}>
        {loans.length === 0 ? <View style={[s.empty, { backgroundColor: p.surface, borderColor: p.border }]}><Text style={[s.cardTitle, { color: p.text }]}>No loans yet</Text><Text style={{ color: p.textMuted, marginTop: 6, textAlign: "center" }}>Add a loan, link an account, and set repayment dates.</Text><Pressable onPress={() => { resetForm(); setFormOpen(true); }} style={[s.primary, { backgroundColor: p.primary }]}><Text style={[s.primaryText, { color: p.onPrimary }]}>Add a loan</Text></Pressable></View> :
        (loans ?? []).map(loan => <Pressable key={loan.id} onPress={() => void openLoan(loan)} style={[s.card, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={s.row}><View style={{ flex: 1 }}><Text style={[s.cardTitle, { color: p.text }]}>{loan.name}</Text><Text style={{ color: p.textMuted, fontSize: 11, marginTop: 3 }}>Flat rate · {loan.monthlyInterestRateBps / 100}% monthly · {loan.accountName ?? "No account"}</Text></View><Text style={[s.status, { color: loan.status === "paid" ? p.success : loan.status === "paused" ? p.warning : p.primary }]}>{loan.status}</Text></View>
          <View style={s.moneyRow}><Text style={[s.big, { color: p.text }]}>{fmt(loan.remainingMinor, loan.currencyCode)}</Text><Text style={{ color: p.textMuted, fontSize: 11 }}>remaining</Text></View>
          <View style={s.moneyRow}><Text style={{ color: p.textMuted, fontSize: 12 }}>Monthly estimate</Text><Text style={{ color: p.text, fontWeight: "700" }}>{fmt(loan.scheduledPaymentMinor, loan.currencyCode)}</Text></View>
          <View style={s.moneyRow}><Text style={{ color: p.textMuted, fontSize: 12 }}>End date</Text><Text style={{ color: p.text, fontWeight: "700" }}>{loan.dueDate}</Text></View>
        </Pressable>)}
      </ScrollView>
    </View>

    <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() =>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}> setFormOpen(false)}>
      <SafeAreaView style={[s.modal, { backgroundColor: p.background }]}><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <View style={s.header}><View style={{ flex: 1 }}><Text style={[s.modalTitle, { color: p.text }]}>{editing ? "Edit loan" : "Add loan"}</Text><Text style={{ color: p.textMuted, fontSize: 12, marginTop: 3 }}>Set the amount, linked account, and repayment dates.</Text></View><Pressable onPress={() => setFormOpen(false)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
        <Text style={[s.label, { color: p.text }]}>Loan name or description *</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Car loan" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        <Text style={[s.label, { color: p.text }]}>Principal amount *</Text><TextInput value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input, s.amount, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        <Text style={[s.label, { color: p.text }]}>Monthly interest rate (%) *</Text><TextInput value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="e.g. 2" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        <DateField label="Start date" required value={startDate} onChange={setStartDate} />
        <DateField label="End date" required value={endDate} onChange={setEndDate} />
        <SelectField label="Linked account" required value={accountId} options={accountOptions} onChange={setAccountId} placeholder="Select account" />
        {error ? <Text style={[s.error, { color: p.expense }]}>{error}</Text> : null}
        <Pressable disabled={saving} onPress={() => void saveLoan()} style={[s.primary, { backgroundColor: p.primary, opacity: saving ? 0.6 : 1 }]}><Text style={[s.primaryText, { color: p.onPrimary }]}>{saving ? "Saving…" : editing ? "Save changes" : "Save loan"}</Text></Pressable>
      </ScrollView></SafeAreaView>
    </KeyboardAvoidingView>
    </Modal>

    <Modal visible={selected !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() =>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}> setSelected(null)}>
      <SafeAreaView style={[s.modal, { backgroundColor: p.background }]} edges={["top", "left", "right"]}>
        {selected ? <ScrollView contentContainerStyle={s.form}>
          <View style={s.header}><View style={{ flex: 1 }}><Text style={[s.modalTitle, { color: p.text }]}>{selected.name}</Text><Text style={{ color: p.textMuted, marginTop: 4 }}>{selected.status} · ends {selected.dueDate}</Text></View><Pressable onPress={() => setSelected(null)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
          <View style={[s.summary, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Text style={{ color: p.textMuted, fontSize: 12 }}>Remaining obligation</Text><Text style={[s.hero, { color: p.text }]}>{fmt(selected.remainingMinor, selected.currencyCode)}</Text>
            <View style={s.moneyRow}><Text style={{ color: p.textMuted }}>Linked account</Text><Text style={{ color: p.text, fontWeight: "700" }}>{selected.accountName}</Text></View>
            <View style={s.moneyRow}><Text style={{ color: p.textMuted }}>Monthly estimate</Text><Text style={{ color: p.text, fontWeight: "700" }}>{fmt(selected.scheduledPaymentMinor, selected.currencyCode)}</Text></View>
            <View style={s.moneyRow}><Text style={{ color: p.textMuted }}>Total interest</Text><Text style={{ color: p.text, fontWeight: "700" }}>{fmt(selected.totalInterestMinor, selected.currencyCode)}</Text></View>
          </View>
          <Pressable onPress={() => openEdit(selected)} style={[s.secondary, { borderColor: p.border }]}><Text style={{ color: p.text, fontWeight: "700" }}>Edit loan</Text></Pressable>
          <Pressable disabled={selected.status === "paid"} onPress={() => { setPaymentDate(today()); setPaymentAmount(""); setPaymentNote(""); setError(""); setPaymentOpen(true); }} style={[s.primary, { backgroundColor: p.primary, opacity: selected.status === "paid" ? 0.5 : 1 }]}><Text style={[s.primaryText, { color: p.onPrimary }]}>Record payment</Text></Pressable>
          {selected.status !== "paid" ? <Pressable onPress={() => void togglePause(selected)} style={[s.secondary, { borderColor: p.border }]}><Text style={{ color: p.text, fontWeight: "700" }}>{selected.status === "active" ? "Pause loan" : "Resume loan"}</Text></Pressable> : null}
          <Pressable onPress={() => deleteLoan(selected)} style={s.dangerButton}><Text style={[s.dangerText, { color: p.expense }]}>Delete loan and history</Text></Pressable>
          <Text style={[s.section, { color: p.text }]}>Payment history</Text>
          {payments.length === 0 ? <Text style={{ color: p.textMuted }}>No payments recorded yet.</Text> : (payments ?? []).map(payment => <View key={payment.id} style={[s.payment, { backgroundColor: p.surface, borderColor: p.border }]}>
            <View style={s.row}><View style={{ flex: 1 }}><Text style={[s.cardTitle, { color: p.text }]}>{fmt(payment.amountMinor, selected.currencyCode)}</Text><Text style={{ color: p.textMuted, fontSize: 11, marginTop: 3 }}>{payment.paymentDate}</Text></View><Text style={{ color: p.textMuted, fontSize: 11 }}>Interest {fmt(payment.interestPaidMinor, selected.currencyCode)}</Text></View>
            <Text style={{ color: p.textMuted, fontSize: 11, marginTop: 5 }}>Principal {fmt(payment.principalPaidMinor, selected.currencyCode)}{payment.notes ? " · " + payment.notes : ""}</Text>
          </View>)}
        </ScrollView> : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
    </Modal>

    <Modal visible={paymentOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() =>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}> setPaymentOpen(false)}>
      <SafeAreaView style={[s.modal, { backgroundColor: p.background }]}><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <View style={s.header}><Text style={[s.modalTitle, { color: p.text }]}>Record payment</Text><Pressable onPress={() => setPaymentOpen(false)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
        <Text style={[s.context, { color: p.textMuted }]}>This payment is recorded as an expense in the loan's linked account.</Text>
        <Text style={[s.label, { color: p.text }]}>Amount *</Text><TextInput value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input, s.amount, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        <DateField label="Payment date" required value={paymentDate} onChange={setPaymentDate} />
        <Text style={[s.label, { color: p.text }]}>Note (optional)</Text><TextInput value={paymentNote} onChangeText={setPaymentNote} placeholder="Optional note" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
        {error ? <Text style={[s.error, { color: p.expense }]}>{error}</Text> : null}
        <Pressable disabled={saving} onPress={() => void savePayment()} style={[s.primary, { backgroundColor: p.primary, opacity: saving ? 0.6 : 1 }]}><Text style={[s.primaryText, { color: p.onPrimary }]}>{saving ? "Saving…" : "Save payment"}</Text></Pressable>
      </ScrollView></SafeAreaView>
    </KeyboardAvoidingView>
    </Modal>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1},page:{flex:1,paddingHorizontal:20,paddingTop:18},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},
  title:{fontSize:29,fontWeight:"800",marginTop:4},add:{paddingHorizontal:17,paddingVertical:11,borderRadius:12},addText:{color:"#fff",fontWeight:"700"},
  sub:{fontSize:14,lineHeight:21,marginTop:8,marginBottom:18},card:{borderWidth:1,borderRadius:18,padding:17},row:{flexDirection:"row",alignItems:"center",gap:10},
  cardTitle:{fontSize:15,fontWeight:"700"},status:{fontSize:11,fontWeight:"800",textTransform:"uppercase"},moneyRow:{flexDirection:"row",alignItems:"baseline",justifyContent:"space-between",marginTop:9},
  big:{fontSize:21,fontWeight:"800"},empty:{borderWidth:1,borderRadius:18,padding:22,alignItems:"center"},primary:{ minHeight: 48, padding: 15,borderRadius:13,alignItems:"center",marginTop:18},
  primaryText:{color:"#fff",fontWeight:"700"},secondary:{padding:14,borderWidth:1,borderRadius:13,alignItems:"center",marginTop:10},dangerButton:{padding:14,alignItems:"center",marginTop:8},
  dangerText:{fontWeight:"700"},modal:{flex:1},form:{padding:22,paddingBottom:40},modalTitle:{fontSize:22,fontWeight:"900"},label:{fontSize:13,fontWeight:"700",marginTop:17,marginBottom:8},
  input:{borderWidth:1,borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:14},amount:{fontSize:22,fontWeight:"800"},error:{fontSize:13,marginTop:12},
  summary:{borderWidth:1,borderRadius:18,padding:17,marginTop:18},hero:{fontSize:30,fontWeight:"800",marginTop:5},section:{fontSize:17,fontWeight:"800",marginTop:26,marginBottom:10},
  payment:{borderWidth:1,borderRadius:14,padding:14,marginBottom:8},context:{fontSize:13,lineHeight:20,marginTop:14},
});