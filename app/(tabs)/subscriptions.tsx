import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAccountRepository, type AccountWithBalance } from "@/database/repositories/account-repository";
import { createSubscriptionRepository, type SubscriptionListItem, type SubscriptionPaymentListItem } from "@/database/repositories/subscription-repository";
import { toMinorUnits } from "@/domain/money";
import { billingCycleLabel, type BillingCycle } from "@/domain/subscriptions";
import { colors } from "@/theme/colors";

const makeId = (prefix: string) => prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number, c: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n / 100);

export default function SubscriptionsScreen() {
  const db = useSQLiteContext();
  const dark = useColorScheme() === "dark";
  const p = dark ? colors.dark : colors.light;
  const [items, setItems] = useState<SubscriptionListItem[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<SubscriptionListItem | null>(null);
  const [payments, setPayments] = useState<SubscriptionPaymentListItem[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [nextBillingDate, setNextBillingDate] = useState(today());
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [subs, acc, cats] = await Promise.all([
        createSubscriptionRepository(db).list(),
        createAccountRepository(db).list(),
        db.getAllAsync<{ id: string; name: string }>(
          "SELECT id, name FROM categories WHERE type = 'expense' ORDER BY name COLLATE NOCASE",
        ),
      ]);
      setItems(subs); setAccounts(acc); setCategories(cats);
      setAccountId(v => v || acc[0]?.id || "");
      setCategoryId(v => v || cats[0]?.id || "");
      if (selected) {
        const fresh = subs.find(item => item.id === selected.id) ?? null;
        setSelected(fresh);
        if (fresh) setPayments(await createSubscriptionRepository(db).listPayments(fresh.id));
      }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load subscriptions.");
    }
  }, [db, selected?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const reset = () => {
    setName(""); setAmount(""); setCycle("monthly"); setNextBillingDate(today());
    setAccountId(accounts[0]?.id ?? ""); setCategoryId(categories[0]?.id ?? ""); setError("");
  };

  const openSubscription = async (item: SubscriptionListItem) => {
    setSelected(item);
    setPaymentAmount((item.amountMinor / 100).toFixed(2));
    setError("");
    try { setPayments(await createSubscriptionRepository(db).listPayments(item.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load payments."); }
  };

  const save = async () => {
    setError("");
    if (!name.trim()) { setError("Enter a subscription name."); return; }
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) { setError("Enter a positive amount."); return; }
    try {
      setSaving(true);
      await createSubscriptionRepository(db).create({
        id: makeId("subscription"), name, amountMinor: toMinorUnits(Number(amount)),
        billingCycle: cycle, nextBillingDate, accountId: accountId || null, categoryId: categoryId || null,
      });
      setFormOpen(false); reset(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save subscription."); }
    finally { setSaving(false); }
  };

  const recordPayment = async () => {
    setError("");
    if (!selected) return;
    if (!/^\d+(\.\d{1,2})?$/.test(paymentAmount.trim()) || Number(paymentAmount) <= 0) { setError("Enter a positive payment amount."); return; }
    try {
      setSaving(true);
      await createSubscriptionRepository(db).recordPayment({
        id: makeId("subscription-payment"), subscriptionId: selected.id,
        amountMinor: toMinorUnits(Number(paymentAmount)), notes: paymentNote,
      });
      setPaymentOpen(false); setPaymentAmount(""); setPaymentNote(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to record payment."); }
    finally { setSaving(false); }
  };

  const toggle = async (item: SubscriptionListItem) => {
    try {
      if (item.isActive) await createSubscriptionRepository(db).pause(item.id);
      else await createSubscriptionRepository(db).resume(item.id);
      await load();
    } catch (e) { Alert.alert("Unable to update subscription", e instanceof Error ? e.message : "Please try again."); }
  };

  const remove = (item: SubscriptionListItem) => Alert.alert(
    "Delete subscription?",
    item.paymentCount > 0 ? "This subscription has payment history and cannot be deleted. You can pause it instead." : "This will permanently remove the subscription.",
    item.paymentCount > 0
      ? [{ text: "OK" }]
      : [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => {
          try { await createSubscriptionRepository(db).delete(item.id); await load(); }
          catch (e) { Alert.alert("Unable to delete", e instanceof Error ? e.message : "Please try again."); }
        } }],
  );

  const removePayment = (payment: SubscriptionPaymentListItem) => Alert.alert(
    "Delete payment?",
    "If this is the latest processed billing cycle, the next billing date will be rolled back.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await createSubscriptionRepository(db).deletePayment(payment.id);
          if (selected) setPayments(await createSubscriptionRepository(db).listPayments(selected.id));
          await load();
        } catch (e) { Alert.alert("Unable to delete payment", e instanceof Error ? e.message : "Please try again."); }
      } },
    ],
  );

  return <SafeAreaView style={[s.safe, { backgroundColor: p.background }]} edges={["top", "left", "right"]}>
    <View style={s.page}>
      <View style={s.header}>
        <View><Text style={{ color: p.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>RECURRING EXPENSES</Text><Text style={[s.title, { color: p.text }]}>Subscriptions</Text></View>
        <Pressable onPress={() => { reset(); setFormOpen(true); }} style={[s.add, { backgroundColor: p.primary }]}><Text style={s.addText}>+ Add</Text></Pressable>
      </View>
      <Text style={[s.sub, { color: p.textMuted }]}>Keep recurring bills organized without changing your account balance.</Text>
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 30 }}>
        {items.length === 0 ? <View style={[s.empty, { backgroundColor: p.surface, borderColor: p.border }]}>
          <Text style={[s.cardTitle, { color: p.text }]}>No subscriptions yet</Text>
          <Text style={{ color: p.textMuted, marginTop: 6 }}>Add a recurring bill and record each billing cycle as it is paid.</Text>
          <Pressable onPress={() => { reset(); setFormOpen(true); }} style={[s.primary, { backgroundColor: p.primary }]}><Text style={s.primaryText}>Add a subscription</Text></Pressable>
        </View> :
        items.map(item => <Pressable key={item.id} onPress={() => void openSubscription(item)} style={[s.card, { backgroundColor: p.surface, borderColor: p.border, opacity: item.isActive ? 1 : 0.7 }]}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: p.text }]}>{item.name}</Text>
              <Text style={{ color: p.textMuted, fontSize: 11, marginTop: 3 }}>{billingCycleLabel(item.billingCycle)} · {item.accountName ?? "No account"}{item.categoryName ? " · " + item.categoryName : ""}</Text>
            </View>
            <Text style={[s.status, { color: item.isActive ? p.primary : p.textMuted }]}>{item.isActive ? "Active" : "Paused"}</Text>
          </View>
          <View style={s.moneyRow}><Text style={[s.big, { color: p.text }]}>{fmt(item.amountMinor, item.currencyCode)}</Text><Text style={{ color: p.textMuted, fontSize: 11 }}>per {item.billingCycle === "yearly" ? "year" : item.billingCycle === "quarterly" ? "quarter" : item.billingCycle === "weekly" ? "week" : "month"}</Text></View>
          <View style={s.moneyRow}><Text style={{ color: p.textMuted, fontSize: 12 }}>Next billing</Text><Text style={{ color: p.text, fontWeight: "700" }}>{item.nextBillingDate || "—"}</Text></View>
        </Pressable>)}
      </ScrollView>
    </View>

    <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormOpen(false)}>
      <SafeAreaView style={[s.modal, { backgroundColor: p.background }]}>
        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <View style={s.header}><Text style={[s.modalTitle, { color: p.text }]}>Add subscription</Text><Pressable onPress={() => setFormOpen(false)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
          <Text style={[s.label, { color: p.text }]}>Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Netflix" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
          <Text style={[s.label, { color: p.text }]}>Amount</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input, s.amount, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
          <Text style={[s.label, { color: p.text }]}>Billing cycle</Text>
          <View style={s.chips}>{(["weekly", "monthly", "quarterly", "yearly"] as BillingCycle[]).map(v => <Pressable key={v} onPress={() => setCycle(v)} style={[s.chip, { backgroundColor: cycle === v ? p.primary : p.surface, borderColor: cycle === v ? p.primary : p.border }]}><Text style={{ color: cycle === v ? "#fff" : p.text, fontWeight: "700" }}>{billingCycleLabel(v)}</Text></Pressable>)}</View>
          <Text style={[s.label, { color: p.text }]}>Next billing date</Text>
          <TextInput value={nextBillingDate} onChangeText={setNextBillingDate} placeholder="YYYY-MM-DD" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
          <Text style={[s.label, { color: p.text }]}>Account (optional)</Text>
          <View style={s.options}>{accounts.map(a => <Pressable key={a.id} onPress={() => setAccountId(a.id)} style={[s.option, { backgroundColor: accountId === a.id ? (dark ? "#3A2424" : "#FCE8E8") : p.surface, borderColor: accountId === a.id ? p.primary : p.border }]}><Text style={{ color: accountId === a.id ? p.primary : p.text, fontWeight: "600" }}>{a.name} · {a.currencyCode}</Text></Pressable>)}</View>
          <Text style={[s.label, { color: p.text }]}>Expense category (optional)</Text>
          <View style={s.options}>{categories.map(c => <Pressable key={c.id} onPress={() => setCategoryId(c.id)} style={[s.option, { backgroundColor: categoryId === c.id ? (dark ? "#3A2424" : "#FCE8E8") : p.surface, borderColor: categoryId === c.id ? p.primary : p.border }]}><Text style={{ color: categoryId === c.id ? p.primary : p.text, fontWeight: "600" }}>{c.name}</Text></Pressable>)}</View>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable disabled={saving} onPress={() => void save()} style={[s.primary, { backgroundColor: p.primary, opacity: saving ? 0.6 : 1 }]}><Text style={s.primaryText}>{saving ? "Saving…" : "Save subscription"}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>

    <Modal visible={selected !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
      <SafeAreaView style={[s.modal, { backgroundColor: p.background }]} edges={["top", "left", "right"]}>
        {selected ? <ScrollView contentContainerStyle={s.form}>
          <View style={s.header}><View><Text style={[s.modalTitle, { color: p.text }]}>{selected.name}</Text><Text style={{ color: p.textMuted, marginTop: 4 }}>{selected.isActive ? "Active" : "Paused"} · next {selected.nextBillingDate || "—"}</Text></View><Pressable onPress={() => setSelected(null)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
          <View style={[s.summary, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Text style={{ color: p.textMuted, fontSize: 12 }}>Recurring amount</Text>
            <Text style={[s.hero, { color: p.text }]}>{fmt(selected.amountMinor, selected.currencyCode)}</Text>
            <View style={s.moneyRow}><Text style={{ color: p.textMuted }}>Cycle</Text><Text style={{ color: p.text, fontWeight: "700" }}>{billingCycleLabel(selected.billingCycle)}</Text></View>
            <View style={s.moneyRow}><Text style={{ color: p.textMuted }}>Payments recorded</Text><Text style={{ color: p.text, fontWeight: "700" }}>{selected.paymentCount}</Text></View>
          </View>
          {selected.isActive ? <Pressable onPress={() => { setPaymentAmount((selected.amountMinor / 100).toFixed(2)); setPaymentNote(""); setError(""); setPaymentOpen(true); }} style={[s.primary, { backgroundColor: p.primary }]}><Text style={s.primaryText}>Record payment</Text></Pressable> : null}
          <Pressable onPress={() => void toggle(selected)} style={[s.secondary, { borderColor: p.border }]}><Text style={{ color: p.text, fontWeight: "700" }}>{selected.isActive ? "Pause subscription" : "Resume subscription"}</Text></Pressable>
          <Pressable onPress={() => remove(selected)} style={s.dangerButton}><Text style={s.dangerText}>Delete subscription</Text></Pressable>
          <Text style={[s.section, { color: p.text }]}>Payment history</Text>
          {payments.length === 0 ? <Text style={{ color: p.textMuted }}>No payments recorded yet.</Text> : payments.map(payment => <View key={payment.id} style={[s.payment, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Pressable onLongPress={() => removePayment(payment)} style={s.row}>
              <View style={{ flex: 1 }}><Text style={[s.cardTitle, { color: p.text }]}>{fmt(payment.amountMinor, selected.currencyCode)}</Text><Text style={{ color: p.textMuted, fontSize: 11, marginTop: 3 }}>Billing {payment.billingDate} · Paid {payment.paidAt.slice(0, 10)}</Text></View>
              <Text style={{ color: p.textMuted, fontSize: 11 }}>Hold to delete</Text>
            </Pressable>
            {payment.notes ? <Text style={{ color: p.textMuted, fontSize: 11, marginTop: 5 }}>{payment.notes}</Text> : null}
          </View>)}
        </ScrollView> : null}
      </SafeAreaView>
    </Modal>

    <Modal visible={paymentOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPaymentOpen(false)}>
      <SafeAreaView style={[s.modal, { backgroundColor: p.background }]}>
        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <View style={s.header}><Text style={[s.modalTitle, { color: p.text }]}>Record payment</Text><Pressable onPress={() => setPaymentOpen(false)}><Text style={{ color: p.textMuted }}>Close</Text></Pressable></View>
          {selected ? <Text style={[s.context, { color: p.textMuted }]}>This records the current billing cycle for <Text style={{ fontWeight: "800", color: p.text }}>{selected.name}</Text>. It does not create an expense transaction or change the account balance.</Text> : null}
          <Text style={[s.label, { color: p.text }]}>Payment amount</Text>
          <TextInput value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input, s.amount, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
          <Text style={[s.label, { color: p.text }]}>Note (optional)</Text>
          <TextInput value={paymentNote} onChangeText={setPaymentNote} placeholder="Optional note" placeholderTextColor={p.textMuted} style={[s.input, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]} />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable disabled={saving} onPress={() => void recordPayment()} style={[s.primary, { backgroundColor: p.primary, opacity: saving ? 0.6 : 1 }]}><Text style={s.primaryText}>{saving ? "Saving…" : "Save payment"}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1 }, page: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 29, fontWeight: "800", marginTop: 4 }, add: { paddingHorizontal: 17, paddingVertical: 11, borderRadius: 12 },
  addText: { color: "#fff", fontWeight: "700" }, sub: { fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 18 },
  card: { borderWidth: 1, borderRadius: 18, padding: 17 }, row: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  cardTitle: { fontSize: 15, fontWeight: "700" }, status: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  moneyRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 },
  big: { fontSize: 20, fontWeight: "800" }, empty: { borderWidth: 1, borderRadius: 18, padding: 20 },
  primary: { padding: 15, borderRadius: 13, alignItems: "center", marginTop: 18 }, primaryText: { color: "#fff", fontWeight: "700" },
  modal: { flex: 1 }, form: { padding: 22, paddingBottom: 40 }, modalTitle: { fontSize: 22, fontWeight: "800" },
  label: { fontSize: 13, fontWeight: "700", marginTop: 17, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 10 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, option: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  amount: { fontSize: 22, fontWeight: "800" }, error: { color: "#D32F2F", fontSize: 13, marginTop: 12 },
  summary: { borderWidth: 1, borderRadius: 18, padding: 18, marginTop: 14 }, hero: { fontSize: 30, fontWeight: "800", marginVertical: 8 },
  section: { fontSize: 16, fontWeight: "800", marginTop: 24, marginBottom: 10 }, payment: { borderWidth: 1, borderRadius: 15, padding: 15, marginBottom: 9 },
  context: { fontSize: 13, lineHeight: 20, marginTop: 15 }, secondary: { borderWidth: 1, padding: 14, borderRadius: 13, alignItems: "center", marginTop: 10 },
  dangerButton: { padding: 14, alignItems: "center", marginTop: 8 }, dangerText: { color: "#D32F2F", fontWeight: "700" },
});
