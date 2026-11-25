import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAccountRepository, type AccountWithBalance } from "@/database/repositories/account-repository";
import { createTransactionRepository, type TransactionListItem } from "@/database/repositories/transaction-repository";
import { toMinorUnits } from "@/domain/money";
import { compareDates } from "@/domain/dates";
import { colors } from "@/theme/colors";

type Kind="income"|"expense"|"transfer"; type Filter="all"|Kind;
const makeId=(p:string)=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const today=()=>new Date().toISOString().slice(0,10);
const fmt=(n:number,c:string)=>new Intl.NumberFormat("en-PH",{style:"currency",currency:c,maximumFractionDigits:2}).format(n/100);

export default function TransactionsScreen(){
 const db=useSQLiteContext();const dark=useColorScheme()==="dark";const p=dark?colors.dark:colors.light;
 const [items,setItems]=useState<TransactionListItem[]>([]);const [accounts,setAccounts]=useState<AccountWithBalance[]>([]);
 const [filter,setFilter]=useState<Filter>("all");const [open,setOpen]=useState(false);const [kind,setKind]=useState<Kind>("expense");
 const [amount,setAmount]=useState("");const [description,setDescription]=useState("");const [notes,setNotes]=useState("");const [date,setDate]=useState(today());
 const [accountId,setAccountId]=useState("");const [destinationId,setDestinationId]=useState("");const [categoryId,setCategoryId]=useState("");
 const [categories,setCategories]=useState<{id:string;name:string}[]>([]);const [saving,setSaving]=useState(false);const [error,setError]=useState("");
 const repo=useMemo(()=>createTransactionRepository(db),[db]);
 const load=useCallback(async()=>{try{const [history,acc]=await Promise.all([repo.listRecent(),createAccountRepository(db).list()]);setItems(history);setAccounts(acc);setAccountId(v=>acc.some(a=>a.id===v)?v:acc[0]?.id??"");setDestinationId(v=>acc.some(a=>a.id===v)?v:acc[1]?.id??"");}catch(e){setError(e instanceof Error?e.message:"Unable to load transactions.");}},[db,repo]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 useEffect(()=>{if(!open||kind==="transfer"){setCategories([]);return;}let alive=true;void repo.listCategories(kind).then(v=>{if(alive){setCategories(v);setCategoryId(old=>v.some(c=>c.id===old)?old:v[0]?.id??"");}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:"Unable to load categories.");});return()=>{alive=false;};},[open,kind,repo]);
 const reset=()=>{setKind("expense");setAmount("");setDescription("");setNotes("");setDate(today());setError("");};
 const save=async()=>{
  setError("");
  if(!/^\d+(\.\d{1,2})?$/.test(amount.trim())||Number(amount)<=0){setError("Enter a positive amount with up to 2 decimal places.");return;}
  try{compareDates(date,date);}catch{setError("Enter a valid date as YYYY-MM-DD.");return;}
  setSaving(true);
  try{
   if(kind==="transfer"){
    if(!accountId||!destinationId)throw new Error("Add at least two accounts before making a transfer.");
    await repo.createTransfer({groupId:makeId("transfer"),sourceAccountId:accountId,destinationAccountId:destinationId,amountMinor:toMinorUnits(Number(amount)),description,notes,occurredAt:date});
   }else{
    if(!accountId||!categoryId)throw new Error("Choose an account and category.");
    await repo.create({id:makeId("txn"),accountId,categoryId,type:kind,amountMinor:toMinorUnits(Number(amount)),description,notes,occurredAt:date});
   }
   setOpen(false);reset();await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to save transaction.");}finally{setSaving(false);}
 };
 const remove=(item:TransactionListItem)=>Alert.alert("Delete transaction?",item.transferGroupId?"Both sides of this transfer will be removed from balances.":"This transaction will be hidden from history and excluded from the account balance.",[{text:"Cancel",style:"cancel"},{text:"Delete",style:"destructive",onPress:async()=>{try{await repo.delete(item.id);await load();}catch(e){Alert.alert("Unable to delete",e instanceof Error?e.message:"Please try again.");}}}]);
 const shown=items.filter(x=>filter==="all"||x.type===filter);
 return <SafeAreaView style={[s.safe,{backgroundColor:p.background}]} edges={["top","left","right"]}>
  <View style={s.page}><View style={s.header}><View><Text style={{color:p.primary,fontSize:11,fontWeight:"800",letterSpacing:1}}>YOUR ACTIVITY</Text><Text style={[s.title,{color:p.text}]}>Transactions</Text></View><Pressable onPress={()=>{reset();setOpen(true);}} style={[s.add,{backgroundColor:p.primary}]}><Text style={s.addText}>+ Add</Text></Pressable></View>
  <Text style={[s.sub,{color:p.textMuted}]}>Record income, expenses, and transfers between accounts.</Text>
  <View style={s.filters}>{(["all","income","expense","transfer"] as Filter[]).map(f=><Pressable key={f} onPress={()=>setFilter(f)} style={[s.filter,{backgroundColor:filter===f?p.primary:p.surface,borderColor:filter===f?p.primary:p.border}]}><Text style={{color:filter===f?"#fff":p.text,fontWeight:"700",fontSize:12,textTransform:"capitalize"}}>{f}</Text></Pressable>)}</View>
  <ScrollView contentContainerStyle={{gap:10,paddingBottom:30}}>{shown.length===0?<View style={[s.empty,{backgroundColor:p.surface,borderColor:p.border}]}><Text style={[s.itemTitle,{color:p.text}]}>Nothing here yet</Text><Text style={{color:p.textMuted,fontSize:13,marginTop:6}}>Your {filter==="all"?"financial activity":filter+"s"} will appear here.</Text></View>:shown.map(item=>{const incoming=item.type==="income"||(item.type==="transfer"&&item.transferDirection==="in");return <View key={item.id} style={[s.card,{backgroundColor:p.surface,borderColor:p.border}]}>
   <View style={s.itemRow}><View style={[s.dot,{backgroundColor:item.type==="income"?p.income:item.type==="expense"?p.expense:p.primary}]}/><View style={{flex:1}}><Text style={[s.itemTitle,{color:p.text}]}>{item.description||item.categoryName||(item.type==="transfer"?"Transfer":item.type)}</Text><Text style={{color:p.textMuted,fontSize:11,marginTop:4}}>{item.accountName} · {item.categoryName??(item.type==="transfer"?"Transfer":item.type)}</Text></View><Text style={{fontWeight:"800",fontSize:12,color:item.type==="income"?p.income:item.type==="expense"?p.expense:p.text}}>{incoming?"+":"−"}{fmt(item.amountMinor,item.currencyCode)}</Text></View>
   <View style={s.bottom}><Text style={{color:p.textMuted,fontSize:11}}>{item.occurredAt}</Text><Pressable onPress={()=>remove(item)} hitSlop={10}><Text style={s.delete}>Delete</Text></Pressable></View>
  </View>;})}</ScrollView></View>
  <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setOpen(false)}><SafeAreaView style={[s.modal,{backgroundColor:p.background}]}><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
   <View style={s.header}><Text style={[s.modalTitle,{color:p.text}]}>Add transaction</Text><Pressable onPress={()=>setOpen(false)}><Text style={{color:p.textMuted}}>Close</Text></Pressable></View>
   <View style={s.kindRow}>{(["expense","income","transfer"] as Kind[]).map(k=><Pressable key={k} onPress={()=>{setKind(k);setError("");}} style={[s.kind,{backgroundColor:kind===k?p.primary:p.surface,borderColor:kind===k?p.primary:p.border}]}><Text style={{color:kind===k?"#fff":p.text,fontWeight:"700",textTransform:"capitalize"}}>{k}</Text></Pressable>)}</View>
   <Text style={[s.label,{color:p.text}]}>Amount</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input,s.amount,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
   <Text style={[s.label,{color:p.text}]}>{kind==="transfer"?"From account":"Account"}</Text>
   <View style={s.options}>{accounts.map(a=><Pressable key={a.id} onPress={()=>setAccountId(a.id)} style={[s.option,{backgroundColor:accountId===a.id?(dark?"#3A2424":"#FCE8E8"):p.surface,borderColor:accountId===a.id?p.primary:p.border}]}><Text style={{color:accountId===a.id?p.primary:p.text,fontWeight:"600"}}>{a.name}</Text><Text style={{color:p.textMuted,fontSize:11}}>{a.currencyCode}</Text></Pressable>)}</View>
   {kind==="transfer"?<><Text style={[s.label,{color:p.text}]}>To account</Text><View style={s.options}>{accounts.filter(a=>a.id!==accountId).map(a=><Pressable key={a.id} onPress={()=>setDestinationId(a.id)} style={[s.option,{backgroundColor:destinationId===a.id?(dark?"#3A2424":"#FCE8E8"):p.surface,borderColor:destinationId===a.id?p.primary:p.border}]}><Text style={{color:destinationId===a.id?p.primary:p.text,fontWeight:"600"}}>{a.name}</Text><Text style={{color:p.textMuted,fontSize:11}}>{a.currencyCode}</Text></Pressable>)}</View><Text style={{color:p.textMuted,fontSize:12,marginTop:8}}>Transfers need two different active accounts with the same currency.</Text></>:<><Text style={[s.label,{color:p.text}]}>Category</Text><View style={s.options}>{categories.map(c=><Pressable key={c.id} onPress={()=>setCategoryId(c.id)} style={[s.option,{backgroundColor:categoryId===c.id?(dark?"#3A2424":"#FCE8E8"):p.surface,borderColor:categoryId===c.id?p.primary:p.border}]}><Text style={{color:categoryId===c.id?p.primary:p.text,fontWeight:"600"}}>{c.name}</Text></Pressable>)}</View></>}
   <Text style={[s.label,{color:p.text}]}>Description (optional)</Text><TextInput value={description} onChangeText={setDescription} placeholder="What was this for?" placeholderTextColor={p.textMuted} style={[s.input,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
   <Text style={[s.label,{color:p.text}]}>Date</Text><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={p.textMuted} style={[s.input,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
   <Text style={[s.label,{color:p.text}]}>Notes (optional)</Text><TextInput value={notes} onChangeText={setNotes} multiline placeholder="Add a note" placeholderTextColor={p.textMuted} style={[s.input,s.notes,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
   {error?<Text style={s.error}>{error}</Text>:null}<Pressable disabled={saving} onPress={save} style={[s.save,{backgroundColor:p.primary,opacity:saving?.6:1}]}><Text style={s.saveText}>{saving?"Saving…":kind==="transfer"?"Save transfer":"Save transaction"}</Text></Pressable>
  </ScrollView></SafeAreaView></Modal>
 </SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1},page:{flex:1,paddingHorizontal:20,paddingTop:18},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},title:{fontSize:29,fontWeight:"800",marginTop:4},add:{paddingHorizontal:17,paddingVertical:11,borderRadius:12},addText:{color:"#fff",fontWeight:"700"},sub:{fontSize:14,lineHeight:21,marginTop:8,marginBottom:16},filters:{flexDirection:"row",gap:7,marginBottom:14},filter:{borderWidth:1,borderRadius:20,paddingHorizontal:13,paddingVertical:9},card:{borderWidth:1,borderRadius:16,padding:14},itemRow:{flexDirection:"row",alignItems:"center",gap:10},dot:{width:9,height:9,borderRadius:5},itemTitle:{fontSize:14,fontWeight:"700"},bottom:{flexDirection:"row",justifyContent:"space-between",marginTop:12},delete:{color:"#D32F2F",fontSize:12,fontWeight:"700"},empty:{borderWidth:1,borderRadius:16,padding:20},modal:{flex:1},form:{padding:22,paddingBottom:40},modalTitle:{fontSize:22,fontWeight:"800"},kindRow:{flexDirection:"row",gap:8,marginTop:20},kind:{flex:1,alignItems:"center",paddingVertical:12,borderRadius:12,borderWidth:1},label:{fontSize:13,fontWeight:"700",marginTop:17,marginBottom:8},input:{borderWidth:1,borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:14},amount:{fontSize:22,fontWeight:"800"},options:{flexDirection:"row",flexWrap:"wrap",gap:8},option:{borderWidth:1,borderRadius:12,paddingHorizontal:12,paddingVertical:10,gap:3},notes:{minHeight:76,textAlignVertical:"top"},error:{color:"#D32F2F",fontSize:13,marginTop:12},save:{borderRadius:13,paddingVertical:15,alignItems:"center",marginTop:22},saveText:{color:"#fff",fontSize:14,fontWeight:"700"}});
