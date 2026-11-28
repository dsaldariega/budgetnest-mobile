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
import { ScreenBackButton } from "@/components/ui/screen-back-button";
import { SelectField } from "@/components/ui/select-field";
import { DateField } from "@/components/ui/date-field";

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
  const [editing, setEditing] = useState<SubscriptionListItem | null>(null);
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
        db.getAllAsync<{ id: string; name: string }>("SELECT id, name FROM categories WHERE type = 'expense' AND source_name = 'subscription' ORDER BY name COLLATE NOCASE"),
      ]);
      setItems(Array.isArray(subs) ? subs : []); setAccounts((Array.isArray(acc) ? acc : []).filter(a => !a.isArchived)); setCategories(Array.isArray(cats) ? cats : []);
      setAccountId(v => v || acc.find(a => !a.isArchived)?.id || "");
      setCategoryId(v => v || cats.find(c => /general|other|misc/i.test(c.name) && !/cloud services/i.test(c.name))?.id || cats[0]?.id || "");
      if (selected) {
        const fresh = subs.find(item => item.id === selected.id) ?? null;
        setSelected(fresh);
        if (fresh) setPayments(await createSubscriptionRepository(db).listPayments(fresh.id));
      }
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load subscriptions."); }
  }, [db, selected?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const reset = () => {
    setEditing(null); setName(""); setAmount(""); setCycle("monthly"); setNextBillingDate(today());
    setAccountId(accounts[0]?.id ?? ""); setCategoryId(categories.find(c => /general|other|misc/i.test(c.name) && !/cloud services/i.test(c.name))?.id ?? categories[0]?.id ?? ""); setError("");
  };

  const openEdit = (item: SubscriptionListItem) => {
    setEditing(item); setName(item.name); setAmount((item.amountMinor / 100).toFixed(2)); setCycle(item.billingCycle);
    setNextBillingDate(item.nextBillingDate || today()); setAccountId(item.accountId ?? accounts[0]?.id ?? "");
    setCategoryId(item.categoryId ?? categories[0]?.id ?? ""); setError(""); setFormOpen(true);
  };

  const openSubscription = async (item: SubscriptionListItem) => {
    setSelected(item); setPaymentAmount((item.amountMinor / 100).toFixed(2)); setError("");
    try { setPayments(await createSubscriptionRepository(db).listPayments(item.id)); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load payments."); }
  };

  const save = async () => {
    setError("");
    if (!name.trim()) { setError("Enter a subscription name."); return; }
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) { setError("Enter a positive amount."); return; }
    if (!accountId) { setError("Choose a linked account."); return; }
    if (!categoryId) { setError("Choose an expense category."); return; }
    try {
      setSaving(true);
      const payload = { id: editing?.id ?? makeId("subscription"), name, amountMinor: toMinorUnits(Number(amount)), billingCycle: cycle, nextBillingDate, accountId, categoryId };
      if (editing) await createSubscriptionRepository(db).update(payload); else await createSubscriptionRepository(db).create(payload);
      setFormOpen(false); reset(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save subscription."); } finally { setSaving(false); }
  };

  const recordPayment = async () => {
    setError("");
    if (!selected) return;
    if (!selected.accountId || !selected.categoryId) { setError("Edit this subscription first and choose a linked account and expense category."); return; }
    if (!/^\d+(\.\d{1,2})?$/.test(paymentAmount.trim()) || Number(paymentAmount) <= 0) { setError("Enter a positive payment amount."); return; }
    try {
      setSaving(true);
      await createSubscriptionRepository(db).recordPayment({ id: makeId("subscription-payment"), subscriptionId: selected.id, amountMinor: toMinorUnits(Number(paymentAmount)), notes: paymentNote });
      setPaymentOpen(false); setPaymentAmount(""); setPaymentNote(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to record payment."); } finally { setSaving(false); }
  };

  const toggle = async (item: SubscriptionListItem) => {
    try { if (item.isActive) await createSubscriptionRepository(db).pause(item.id); else await createSubscriptionRepository(db).resume(item.id); await load(); }
    catch (e) { Alert.alert("Unable to update subscription", e instanceof Error ? e.message : "Please try again."); }
  };

  const remove = (item: SubscriptionListItem) => Alert.alert(
    "Delete subscription and payment history?",
    "The subscription, billing history, and linked expense transactions will be permanently deleted from active records.",
    [{ text: "Cancel", style: "cancel" }, { text: "Delete subscription", style: "destructive", onPress: async () => {
      try { await createSubscriptionRepository(db).delete(item.id); setSelected(null); setPayments([]); await load(); }
      catch (e) { Alert.alert("Unable to delete", e instanceof Error ? e.message : "Please try again."); }
    }}],
  );

  const removePayment = (payment: SubscriptionPaymentListItem) => Alert.alert(
    "Delete payment?",
    "The linked expense transaction will also be removed from the account balance.",
    [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => {
      try { await createSubscriptionRepository(db).deletePayment(payment.id); if (selected) setPayments(await createSubscriptionRepository(db).listPayments(selected.id)); await load(); }
      catch (e) { Alert.alert("Unable to delete payment", e instanceof Error ? e.message : "Please try again."); }
    }}],
  );

  const accountOptions = (accounts ?? []).map(a => ({ value: a.id, label: a.name, description: a.currencyCode + " · " + fmt(a.balanceMinor, a.currencyCode) }));
  const categoryOptions = (categories ?? []).map(c => ({ value: c.id, label: c.name }));

  return <SafeAreaView style={[s.safe, { backgroundColor: p.background }]} edges={["top","left","right"]}>
    <View style={s.page}>
      <View style={s.header}><ScreenBackButton backgroundColor={p.surface} borderColor={p.border} color={p.text}/><View style={{flex:1}}><Text style={{color:p.primary,fontSize:11,fontWeight:"800",letterSpacing:1}}>RECURRING EXPENSES</Text><Text style={[s.title,{color:p.text}]}>Subscriptions</Text></View>{items.length>0?<Pressable onPress={()=>{reset();setFormOpen(true)}} style={[s.add,{backgroundColor:p.primary}]}><Text style={s.addText}>+ Add</Text></Pressable>:null}</View>
      <Text style={[s.sub,{color:p.textMuted}]}>Manage services and memberships that require periodic payment. Recording a payment updates the linked account and transaction history.</Text>
      <ScrollView contentContainerStyle={{gap:12,paddingBottom:30}}>
        {items.length===0?<View style={[s.empty,{backgroundColor:p.surface,borderColor:p.border}]}><Text style={[s.cardTitle,{color:p.text}]}>No subscriptions yet</Text><Text style={{color:p.textMuted,marginTop:6,textAlign:"center"}}>Track services and memberships with their billing dates and payments.</Text><Pressable onPress={()=>{reset();setFormOpen(true)}} style={[s.primary,{backgroundColor:p.primary}]}><Text style={s.primaryText}>Add a subscription</Text></Pressable></View>:
        (items ?? []).map(item=><Pressable key={item.id} onPress={()=>void openSubscription(item)} style={[s.card,{backgroundColor:p.surface,borderColor:p.border,opacity:item.isActive?1:0.7}]}>
          <View style={s.row}><View style={{flex:1}}><Text style={[s.cardTitle,{color:p.text}]}>{item.name}</Text><Text style={{color:p.textMuted,fontSize:11,marginTop:3}}>{billingCycleLabel(item.billingCycle)} · {item.accountName??"No account"}{item.categoryName?" · "+item.categoryName:""}</Text></View><Text style={[s.status,{color:item.isActive?p.primary:p.textMuted}]}>{item.isActive?"Active":"Paused"}</Text></View>
          <View style={s.moneyRow}><Text style={[s.big,{color:p.text}]}>{fmt(item.amountMinor,item.currencyCode)}</Text><Text style={{color:p.textMuted,fontSize:11}}>per {item.billingCycle==="yearly"?"year":item.billingCycle==="quarterly"?"quarter":item.billingCycle==="weekly"?"week":"month"}</Text></View>
          <View style={s.moneyRow}><Text style={{color:p.textMuted,fontSize:12}}>Next billing</Text><Text style={{color:p.text,fontWeight:"700"}}>{item.nextBillingDate||"—"}</Text></View>
        </Pressable>)}
      </ScrollView>
    </View>

    <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setFormOpen(false)}>
      <SafeAreaView style={[s.modal,{backgroundColor:p.background}]}><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <View style={s.header}><View style={{flex:1}}><Text style={[s.modalTitle,{color:p.text}]}>{editing?"Edit subscription":"Add subscription"}</Text><Text style={{color:p.textMuted,fontSize:12,marginTop:3}}>Track a service or membership, its billing cycle, and payments.</Text></View><Pressable onPress={()=>setFormOpen(false)}><Text style={{color:p.textMuted}}>Close</Text></Pressable></View>
        <Text style={[s.label,{color:p.text}]}>Subscription name *</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Netflix" placeholderTextColor={p.textMuted} style={[s.input,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
        <Text style={[s.label,{color:p.text}]}>Amount *</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input,s.amount,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
        <Text style={[s.label,{color:p.text}]}>Billing cycle</Text><View style={s.chips}>{(["weekly","monthly","quarterly","yearly"] as BillingCycle[]).map(v=><Pressable key={v} onPress={()=>setCycle(v)} style={[s.chip,{backgroundColor:cycle===v?p.primary:p.surface,borderColor:cycle===v?p.primary:p.border}]}><Text numberOfLines={1} allowFontScaling={false} style={{color:cycle===v?"#fff":p.text,fontWeight:"700",fontSize:10.5}}>{billingCycleLabel(v)}</Text></Pressable>)}</View>
        <DateField label="Next billing date" required value={nextBillingDate} onChange={setNextBillingDate}/>
        <SelectField label="Linked account" required value={accountId} options={accountOptions} onChange={setAccountId} placeholder="Select account"/>
        <SelectField label="Expense category" required value={categoryId} options={categoryOptions} onChange={setCategoryId} placeholder="Select subscription category"/>
        {error?<Text style={s.error}>{error}</Text>:null}
        <Pressable disabled={saving} onPress={()=>void save()} style={[s.primary,{backgroundColor:p.primary,opacity:saving?0.6:1}]}><Text style={s.primaryText}>{saving?"Saving…":editing?"Save changes":"Save subscription"}</Text></Pressable>
      </ScrollView></SafeAreaView>
    </Modal>

    <Modal visible={selected!==null} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setSelected(null)}>
      <SafeAreaView style={[s.modal,{backgroundColor:p.background}]} edges={["top","left","right"]}>
        {selected?<ScrollView contentContainerStyle={s.form}>
          <View style={s.header}><View style={{flex:1}}><Text style={[s.modalTitle,{color:p.text}]}>{selected.name}</Text><Text style={{color:p.textMuted,marginTop:4}}>{selected.isActive?"Active":"Paused"} · next {selected.nextBillingDate||"—"}</Text></View><Pressable onPress={()=>setSelected(null)}><Text style={{color:p.textMuted}}>Close</Text></Pressable></View>
          <View style={[s.summary,{backgroundColor:p.surface,borderColor:p.border}]}><Text style={{color:p.textMuted,fontSize:12}}>Recurring amount</Text><Text style={[s.hero,{color:p.text}]}>{fmt(selected.amountMinor,selected.currencyCode)}</Text><View style={s.moneyRow}><Text style={{color:p.textMuted}}>Linked account</Text><Text style={{color:p.text,fontWeight:"700"}}>{selected.accountName??"Not set"}</Text></View><View style={s.moneyRow}><Text style={{color:p.textMuted}}>Category</Text><Text style={{color:p.text,fontWeight:"700"}}>{selected.categoryName??"Not set"}</Text></View><View style={s.moneyRow}><Text style={{color:p.textMuted}}>Payments recorded</Text><Text style={{color:p.text,fontWeight:"700"}}>{selected.paymentCount}</Text></View></View>
          <Pressable onPress={()=>openEdit(selected)} style={[s.secondary,{borderColor:p.border}]}><Text style={{color:p.text,fontWeight:"700"}}>Edit subscription</Text></Pressable>
          {selected.isActive?<Pressable onPress={()=>{setPaymentAmount((selected.amountMinor/100).toFixed(2));setPaymentNote("");setError("");setPaymentOpen(true)}} style={[s.primary,{backgroundColor:p.primary}]}><Text style={s.primaryText}>Record payment</Text></Pressable>:null}
          <Pressable onPress={()=>void toggle(selected)} style={[s.secondary,{borderColor:p.border}]}><Text style={{color:p.text,fontWeight:"700"}}>{selected.isActive?"Pause subscription":"Resume subscription"}</Text></Pressable>
          <Pressable onPress={()=>remove(selected)} style={s.dangerButton}><Text style={s.dangerText}>Delete subscription</Text></Pressable>
          <Text style={[s.section,{color:p.text}]}>Payment history</Text>
          {payments.length===0?<Text style={{color:p.textMuted}}>No payments recorded yet.</Text>:(payments ?? []).map(payment=><Pressable key={payment.id} onLongPress={()=>removePayment(payment)} style={[s.payment,{backgroundColor:p.surface,borderColor:p.border}]}><View style={s.row}><View style={{flex:1}}><Text style={[s.cardTitle,{color:p.text}]}>{fmt(payment.amountMinor,selected.currencyCode)}</Text><Text style={{color:p.textMuted,fontSize:11,marginTop:3}}>Billing {payment.billingDate} · Paid {payment.paidAt.slice(0,10)}</Text></View><Text style={{color:p.textMuted,fontSize:11}}>Hold to delete</Text></View>{payment.notes?<Text style={{color:p.textMuted,fontSize:11,marginTop:5}}>{payment.notes}</Text>:null}</Pressable>)}
        </ScrollView>:null}
      </SafeAreaView>
    </Modal>

    <Modal visible={paymentOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setPaymentOpen(false)}>
      <SafeAreaView style={[s.modal,{backgroundColor:p.background}]}><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <View style={s.header}><Text style={[s.modalTitle,{color:p.text}]}>Record payment</Text><Pressable onPress={()=>setPaymentOpen(false)}><Text style={{color:p.textMuted}}>Close</Text></Pressable></View>
        <Text style={[s.context,{color:p.textMuted}]}>The payment will create an expense transaction and deduct from the selected account.</Text>
        <Text style={[s.label,{color:p.text}]}>Payment amount *</Text><TextInput value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input,s.amount,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
        <Text style={[s.label,{color:p.text}]}>Note (optional)</Text><TextInput value={paymentNote} onChangeText={setPaymentNote} placeholder="Optional note" placeholderTextColor={p.textMuted} style={[s.input,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
        {error?<Text style={s.error}>{error}</Text>:null}
        <Pressable disabled={saving} onPress={()=>void recordPayment()} style={[s.primary,{backgroundColor:p.primary,opacity:saving?0.6:1}]}><Text style={s.primaryText}>{saving?"Saving…":"Save payment"}</Text></Pressable>
      </ScrollView></SafeAreaView></Modal>
  </SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1},page:{flex:1,paddingHorizontal:20,paddingTop:18},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},
 title:{fontSize:29,fontWeight:"800",marginTop:4},add:{paddingHorizontal:17,paddingVertical:11,borderRadius:12},addText:{color:"#fff",fontWeight:"700"},
 sub:{fontSize:14,lineHeight:21,marginTop:8,marginBottom:18},card:{borderWidth:1,borderRadius:18,padding:17},row:{flexDirection:"row",alignItems:"center",gap:10},
 cardTitle:{fontSize:15,fontWeight:"700"},status:{fontSize:11,fontWeight:"800",textTransform:"uppercase"},moneyRow:{flexDirection:"row",alignItems:"baseline",justifyContent:"space-between",marginTop:9},
 big:{fontSize:20,fontWeight:"800"},empty:{borderWidth:1,borderRadius:18,padding:22,alignItems:"center"},primary:{padding:15,borderRadius:13,alignItems:"center",marginTop:18},
 primaryText:{color:"#fff",fontWeight:"700"},secondary:{padding:14,borderWidth:1,borderRadius:13,alignItems:"center",marginTop:10},dangerButton:{padding:14,alignItems:"center",marginTop:8},
 dangerText:{color:"#D32F2F",fontWeight:"700"},modal:{flex:1},form:{padding:22,paddingBottom:40},modalTitle:{fontSize:22,fontWeight:"900"},
 label:{fontSize:13,fontWeight:"700",marginTop:17,marginBottom:8},chips:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{borderWidth:1,borderRadius:20,paddingHorizontal:13,paddingVertical:10},
 input:{borderWidth:1,borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:14},amount:{fontSize:22,fontWeight:"800"},error:{color:"#D32F2F",fontSize:13,marginTop:12},
 summary:{borderWidth:1,borderRadius:18,padding:18,marginTop:16},hero:{fontSize:30,fontWeight:"800",marginVertical:8},section:{fontSize:16,fontWeight:"800",marginTop:24,marginBottom:10},
 payment:{borderWidth:1,borderRadius:15,padding:15,marginBottom:9},context:{fontSize:13,lineHeight:20,marginTop:14},
});
