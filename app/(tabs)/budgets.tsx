import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { useFocusEffect } from "expo-router";
import { todayLocalDate } from "@/domain/dates";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAccountRepository, type AccountWithBalance } from "@/database/repositories/account-repository";
import { createBudgetRepository, type BudgetListItem } from "@/database/repositories/budget-repository";
import { toMinorUnits } from "@/domain/money";
import { compareDates } from "@/domain/dates";
import { colors } from "@/theme/colors";
import { SelectField } from "@/components/ui/select-field";
import { DateField } from "@/components/ui/date-field";

type Period = "weekly" | "monthly" | "yearly";
const makeId = () => "budget-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
const today = todayLocalDate;
const fmt = (n: number, c: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n / 100);

export default function BudgetsScreen() {
  const db = useSQLiteContext(); const dark = useColorScheme() === "dark"; const p = dark ? colors.dark : colors.light;
  const [items, setItems] = useState<BudgetListItem[]>([]); const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]); const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetListItem | null>(null);
  const [name, setName] = useState(""); const [period, setPeriod] = useState<Period>("monthly");
  const [accountId, setAccountId] = useState(""); const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState(""); const [startDate, setStartDate] = useState(today());
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [budgets, acc, cats] = await Promise.all([
        createBudgetRepository(db).list(today()), createAccountRepository(db).list(),
        db.getAllAsync<{ id: string; name: string }>("SELECT id, name FROM categories WHERE type = 'expense' ORDER BY is_system DESC, name COLLATE NOCASE"),
      ]);
      setItems(budgets); setAccounts(acc.filter(a => !a.isArchived)); setCategories(cats);
      setAccountId(v => v || acc.find(a => !a.isArchived)?.id || ""); setCategoryId(v => v || cats[0]?.id || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load budgets."); }
  }, [db]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const reset = () => { setEditing(null); setName(""); setPeriod("monthly"); setAmount(""); setStartDate(today()); setAccountId(accounts[0]?.id ?? ""); setCategoryId(categories[0]?.id ?? ""); setError(""); };
  const openEdit = (item: BudgetListItem) => { setEditing(item); setName(item.name); setPeriod(item.period as Period); setAmount((item.amountMinor / 100).toFixed(2)); setStartDate(item.startDate); setAccountId(item.accountId); setCategoryId(item.categoryId); setError(""); setOpen(true); };

  const save = async () => {
    setError("");
    if (!name.trim()) { setError("Enter a budget name."); return; }
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) { setError("Enter a positive budget amount."); return; }
    if (!accountId || !categoryId) { setError("Choose an account and category."); return; }
    try {
      compareDates(startDate, startDate); setSaving(true);
      const payload = { id: editing?.id ?? makeId(), name, categoryId, accountId, period, startDate, endDate: null, amountMinor: toMinorUnits(Number(amount)) };
      if (editing) await createBudgetRepository(db).update(payload); else await createBudgetRepository(db).create(payload);
      setOpen(false); reset(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save budget."); } finally { setSaving(false); }
  };

  const remove = (item: BudgetListItem) => Alert.alert("Delete budget?", "Delete “" + item.name + "” and its spending-limit setup?", [
    { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { await createBudgetRepository(db).delete(item.id); await load(); } catch (e) { Alert.alert("Unable to delete", e instanceof Error ? e.message : "Please try again."); } } },
  ]);

  const accountOptions = accounts.map(a => ({ value: a.id, label: a.name, description: a.currencyCode + " · " + fmt(a.balanceMinor, a.currencyCode) }));
  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));

  return <SafeAreaView style={[s.safe,{backgroundColor:p.background}]} edges={["top","left","right"]}>
    <View style={s.page}>
      <View style={s.header}><View><Text style={{color:p.primary,fontSize:11,fontWeight:"800",letterSpacing:1}}>PLAN YOUR SPENDING</Text><Text style={[s.title,{color:p.text}]}>Budgets</Text></View>{items.length>0?<Pressable onPress={()=>{reset();setOpen(true)}} style={[s.add,{backgroundColor:p.primary}]}><Text style={s.addText}>+ Add</Text></Pressable>:null}</View>
      <Text style={[s.sub,{color:p.textMuted}]}>Set spending limits by category and period, then monitor actual spending against each limit.</Text>
      <ScrollView contentContainerStyle={{gap:12,paddingBottom:30}}>
        {items.length===0?<View style={[s.empty,{backgroundColor:p.surface,borderColor:p.border}]}><Text style={[s.cardTitle,{color:p.text}]}>No budgets yet</Text><Text style={{color:p.textMuted,marginTop:6,textAlign:"center"}}>Create a weekly, monthly, or yearly spending limit.</Text><Pressable onPress={()=>{reset();setOpen(true)}} style={[s.primary,{backgroundColor:p.primary}]}><Text style={s.primaryText}>Create a budget</Text></Pressable></View>:
        items.map(item=><View key={item.id} style={[s.card,{backgroundColor:p.surface,borderColor:p.border}]}>
          <View style={s.row}><View style={{flex:1}}><Text style={[s.cardTitle,{color:p.text}]}>{item.name}</Text><Text style={{color:p.textMuted,fontSize:11,marginTop:3}}>{item.categoryName} · {item.accountName} · {item.period}</Text></View><View style={s.rowActions}><Pressable onPress={()=>openEdit(item)}><Text style={{color:p.primary,fontSize:12,fontWeight:"800"}}>Edit</Text></Pressable><Pressable onPress={()=>remove(item)}><Text style={s.delete}>Delete</Text></Pressable></View></View>
          <View style={s.moneyRow}><Text style={[s.spent,{color:p.text}]}>{fmt(item.spentMinor,item.currencyCode)}</Text><Text style={{color:p.textMuted,fontSize:12}}>of {fmt(item.amountMinor,item.currencyCode)}</Text></View>
          <View style={[s.track,{backgroundColor:dark?"#332B2B":"#EEEFF2"}]}><View style={[s.fill,{width:Math.min(100,Math.round(item.progress*100))+"%",backgroundColor:item.progress>1?p.primary:p.income}]} /></View>
          <View style={s.moneyRow}><Text style={{color:item.remainingMinor<0?p.primary:p.textMuted,fontSize:12}}>{item.remainingMinor<0?fmt(Math.abs(item.remainingMinor),item.currencyCode)+" over budget":fmt(item.remainingMinor,item.currencyCode)+" remaining"}</Text><Text style={{color:p.textMuted,fontSize:11}}>Starts {item.startDate}</Text></View>
        </View>)}
      </ScrollView>
    </View>
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setOpen(false)}>
      <SafeAreaView style={[s.modal,{backgroundColor:p.background}]}><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <View style={s.header}><View style={{flex:1}}><Text style={[s.modalTitle,{color:p.text}]}>{editing?"Edit budget":"Add budget"}</Text><Text style={{color:p.textMuted,fontSize:12,marginTop:3}}>Budgets are setup rules; actual spending comes from recorded expense transactions.</Text></View><Pressable onPress={()=>setOpen(false)}><Text style={{color:p.textMuted}}>Close</Text></Pressable></View>
        <Text style={[s.label,{color:p.text}]}>Budget name *</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Monthly groceries" placeholderTextColor={p.textMuted} style={[s.input,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
        <SelectField label="Category" required value={categoryId} options={categoryOptions} onChange={setCategoryId} placeholder="Select spending category"/>
        <Text style={[s.label,{color:p.text}]}>Budget amount *</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input,s.amount,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
        <Text style={[s.label,{color:p.text}]}>Budget period</Text><View style={s.chips}>{(["weekly","monthly","yearly"] as Period[]).map(v=><Pressable key={v} onPress={()=>setPeriod(v)} style={[s.chip,{backgroundColor:period===v?p.primary:p.surface,borderColor:period===v?p.primary:p.border}]}><Text style={{color:period===v?"#fff":p.text,fontWeight:"700"}}>{v[0].toUpperCase()+v.slice(1)}</Text></Pressable>)}</View>
        <DateField label="Start date" required value={startDate} onChange={setStartDate}/>
        <SelectField label="Account" required value={accountId} options={accountOptions} onChange={setAccountId} placeholder="Select account"/>
        {error?<Text style={s.error}>{error}</Text>:null}
        <Pressable disabled={saving} onPress={()=>void save()} style={[s.primary,{backgroundColor:p.primary,opacity:saving?0.6:1}]}><Text style={s.primaryText}>{saving?"Saving…":editing?"Save changes":"Save budget"}</Text></Pressable>
      </ScrollView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const s=StyleSheet.create({
 safe:{flex:1},page:{flex:1,paddingHorizontal:20,paddingTop:18},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},title:{fontSize:29,fontWeight:"800",marginTop:4},add:{paddingHorizontal:17,paddingVertical:11,borderRadius:12},addText:{color:"#fff",fontWeight:"700"},
 sub:{fontSize:14,lineHeight:21,marginTop:8,marginBottom:18},card:{borderWidth:1,borderRadius:18,padding:17},row:{flexDirection:"row",alignItems:"center",gap:10},rowActions:{flexDirection:"row",alignItems:"center",gap:14},cardTitle:{fontSize:15,fontWeight:"700"},delete:{color:"#D32F2F",fontSize:12,fontWeight:"700"},
 moneyRow:{flexDirection:"row",alignItems:"baseline",justifyContent:"space-between",marginBottom:8},spent:{fontSize:20,fontWeight:"800"},track:{height:8,borderRadius:8,overflow:"hidden"},fill:{height:8,borderRadius:8},empty:{borderWidth:1,borderRadius:18,padding:22,alignItems:"center"},primary:{padding:15,borderRadius:13,alignItems:"center",marginTop:18},primaryText:{color:"#fff",fontWeight:"700"},
 modal:{flex:1},form:{padding:22,paddingBottom:40},modalTitle:{fontSize:22,fontWeight:"900"},label:{fontSize:13,fontWeight:"700",marginTop:17,marginBottom:8},chips:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{borderWidth:1,borderRadius:20,paddingHorizontal:13,paddingVertical:10},input:{borderWidth:1,borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:14},amount:{fontSize:22,fontWeight:"800"},error:{color:"#D32F2F",fontSize:13,marginTop:12}
});
