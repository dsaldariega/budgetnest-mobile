import { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAccountRepository, type AccountWithBalance } from "@/database/repositories/account-repository";
import type { AccountType } from "@/database/types";
import { toMinorUnits } from "@/domain/money";
import { colors } from "@/theme/colors";

const TYPES: {value: AccountType; label: string}[] = [
 {value:"cash",label:"Cash"},{value:"bank",label:"Bank"},{value:"e_wallet",label:"E-wallet"},
 {value:"credit_card",label:"Credit card"},{value:"investment",label:"Investment"},{value:"other",label:"Other"}
];
const makeId=()=>`acc-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const fmt=(n:number,c:string)=>new Intl.NumberFormat("en-PH",{style:"currency",currency:c,maximumFractionDigits:2}).format(n/100);

export default function AccountsScreen(){
 const db=useSQLiteContext(); const dark=useColorScheme()==="dark"; const p=dark?colors.dark:colors.light;
 const [rows,setRows]=useState<AccountWithBalance[]>([]); const [open,setOpen]=useState(false); const [loading,setLoading]=useState(true);
 const [name,setName]=useState(""); const [type,setType]=useState<AccountType>("cash"); const [currency,setCurrency]=useState("PHP"); const [opening,setOpening]=useState("0");
 const [error,setError]=useState(""); const [saving,setSaving]=useState(false);
 const load=useCallback(async()=>{setLoading(true);try{setRows(await createAccountRepository(db).list());}catch(e){setError(e instanceof Error?e.message:"Unable to load accounts.");}finally{setLoading(false);}},[db]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 const reset=()=>{setName("");setType("cash");setCurrency("PHP");setOpening("0");setError("");};
 const save=async()=>{setError("");const n=Number(opening||"0");if(!name.trim()){setError("Enter an account name.");return;}if(!Number.isFinite(n)){setError("Enter a valid opening balance.");return;}setSaving(true);try{await createAccountRepository(db).create({id:makeId(),name,type,sourceType:null,currencyCode:currency,openingBalanceMinor:toMinorUnits(n)});setOpen(false);reset();await load();}catch(e){setError(e instanceof Error?e.message:"Unable to save account.");}finally{setSaving(false);}};
 const archive=(a:AccountWithBalance)=>Alert.alert("Archive account?",`“${a.name}” will be hidden from active accounts. Its history will be kept.`,[{text:"Cancel",style:"cancel"},{text:"Archive",style:"destructive",onPress:async()=>{try{await createAccountRepository(db).archive(a.id);await load();}catch(e){Alert.alert("Unable to archive",e instanceof Error?e.message:"Please try again.");}}}]);
 return <SafeAreaView style={[s.safe,{backgroundColor:p.background}]} edges={["top","left","right"]}>
  <View style={s.page}><View style={s.header}><View><Text style={{color:p.primary,fontSize:11,fontWeight:"800",letterSpacing:1}}>YOUR MONEY</Text><Text style={[s.title,{color:p.text}]}>Accounts</Text></View><Pressable onPress={()=>{reset();setOpen(true);}} style={[s.add,{backgroundColor:p.primary}]}><Text style={s.addText}>+ Add</Text></Pressable></View>
  <Text style={[s.sub,{color:p.textMuted}]}>Manage the places where you keep your money.</Text>
  {loading?<Text style={{color:p.textMuted}}>Loading accounts…</Text>:rows.length===0?<View style={[s.empty,{backgroundColor:p.surface,borderColor:p.border}]}><Text style={[s.cardTitle,{color:p.text}]}>No accounts yet</Text><Text style={{color:p.textMuted,marginTop:6}}>Add your cash, bank, or e-wallet account to get started.</Text><Pressable onPress={()=>setOpen(true)} style={[s.primary,{backgroundColor:p.primary}]}><Text style={s.primaryText}>Create your first account</Text></Pressable></View>:
  <ScrollView contentContainerStyle={{gap:12,paddingBottom:30}}>{rows.map(a=><View key={a.id} style={[s.card,{backgroundColor:p.surface,borderColor:p.border}]}>
   <View style={s.row}><View style={[s.icon,{backgroundColor:dark?"#3A2424":"#FCE8E8"}]}><Text style={{color:p.primary,fontWeight:"800"}}>{a.name.slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={[s.cardTitle,{color:p.text}]}>{a.name}</Text><Text style={{color:p.textMuted,fontSize:12,marginTop:3}}>{TYPES.find(t=>t.value===a.type)?.label??"Other"} · {a.currencyCode}</Text></View><Pressable onPress={()=>archive(a)} hitSlop={10}><Text style={{color:p.textMuted,fontWeight:"800"}}>•••</Text></Pressable></View>
   <Text style={[s.label,{color:p.textMuted}]}>CURRENT BALANCE</Text><Text style={[s.balance,{color:p.text}]}>{fmt(a.balanceMinor,a.currencyCode)}</Text>
  </View>)}</ScrollView>}
  </View>
  <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setOpen(false)}><SafeAreaView style={[s.modal,{backgroundColor:p.background}]}><ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
   <View style={s.header}><Text style={[s.modalTitle,{color:p.text}]}>Add account</Text><Pressable onPress={()=>setOpen(false)}><Text style={{color:p.textMuted}}>Close</Text></Pressable></View>
   <Text style={[s.fieldLabel,{color:p.text}]}>Account name</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Main Savings" placeholderTextColor={p.textMuted} style={[s.input,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
   <Text style={[s.fieldLabel,{color:p.text}]}>Account type</Text><View style={s.chips}>{TYPES.map(t=><Pressable key={t.value} onPress={()=>setType(t.value)} style={[s.chip,{borderColor:type===t.value?p.primary:p.border,backgroundColor:type===t.value?(dark?"#3A2424":"#FCE8E8"):p.surface}]}><Text style={{color:type===t.value?p.primary:p.text,fontSize:12,fontWeight:"600"}}>{t.label}</Text></Pressable>)}</View>
   <Text style={[s.fieldLabel,{color:p.text}]}>Currency code</Text><TextInput value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} placeholder="PHP" placeholderTextColor={p.textMuted} style={[s.input,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
   <Text style={[s.fieldLabel,{color:p.text}]}>Opening balance</Text><TextInput value={opening} onChangeText={setOpening} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={p.textMuted} style={[s.input,{color:p.text,backgroundColor:p.surface,borderColor:p.border}]}/>
   {error?<Text style={s.error}>{error}</Text>:null}<Pressable disabled={saving} onPress={save} style={[s.primary,{backgroundColor:p.primary,opacity:saving?0.6:1}]}><Text style={s.primaryText}>{saving?"Saving…":"Save account"}</Text></Pressable>
  </ScrollView></SafeAreaView></Modal>
 </SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1},page:{flex:1,paddingHorizontal:20,paddingTop:18},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},title:{fontSize:29,fontWeight:"800",marginTop:4},add:{paddingHorizontal:17,paddingVertical:11,borderRadius:12},addText:{color:"#fff",fontWeight:"700"},sub:{fontSize:14,marginTop:8,marginBottom:20},card:{borderWidth:1,borderRadius:18,padding:17},row:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:18},icon:{width:42,height:42,borderRadius:14,alignItems:"center",justifyContent:"center"},cardTitle:{fontSize:15,fontWeight:"700"},label:{fontSize:10,fontWeight:"700",letterSpacing:.8},balance:{fontSize:23,fontWeight:"800",marginTop:5},empty:{borderWidth:1,borderRadius:18,padding:20},primary:{padding:15,borderRadius:13,alignItems:"center",marginTop:18},primaryText:{color:"#fff",fontWeight:"700"},modal:{flex:1},form:{padding:22,paddingBottom:40},modalTitle:{fontSize:22,fontWeight:"800"},fieldLabel:{fontSize:13,fontWeight:"700",marginTop:18,marginBottom:8},input:{borderWidth:1,borderRadius:12,paddingHorizontal:14,paddingVertical:13,fontSize:15},chips:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{borderWidth:1,borderRadius:20,paddingHorizontal:13,paddingVertical:9},error:{color:"#D32F2F",fontSize:13,marginTop:12}});
