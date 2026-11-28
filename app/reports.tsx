import { useCallback,useState } from "react";
import { Pressable,ScrollView,StyleSheet,Text,View,useColorScheme } from "react-native";
import { useFocusEffect,useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createReportRepository, type ReportCurrencySummary,type ReportCategoryTotal,type ReportMonthTotal } from "@/database/repositories/report-repository";
import { colors } from "@/theme/colors";
import { EmptyState } from "@/components/EmptyState";
import { addMonthsClamped, todayLocalDate } from "@/domain/dates";
type Period="month"|"quarter"|"year";
const today = todayLocalDate;
function range(period:Period){const end=today();const monthStart=`${end.slice(0,7)}-01`;const start=period==="year"?`${end.slice(0,4)}-01-01`:period==="quarter"?addMonthsClamped(monthStart,-2):monthStart;return {from:start,to:end};}
const money=(n:number,c:string)=>new Intl.NumberFormat("en-PH",{style:"currency",currency:c,maximumFractionDigits:2}).format(n/100);
const monthName=(v:string)=>new Date(v+"-01T00:00:00").toLocaleDateString("en-PH",{month:"short",year:"2-digit"});
export default function ReportsScreen(){
 const db=useSQLiteContext(),router=useRouter(),dark=useColorScheme()==="dark",p=dark?colors.dark:colors.light;
 const [period,setPeriod]=useState<Period>("month"),[summary,setSummary]=useState<ReportCurrencySummary[]>([]),[categories,setCategories]=useState<ReportCategoryTotal[]>([]),[trend,setTrend]=useState<ReportMonthTotal[]>([]),[error,setError]=useState("");
 const load=useCallback(async()=>{try{const r=range(period);const repo=createReportRepository(db);const [s,c,t]=await Promise.all([repo.summary(r.from,r.to),repo.expensesByCategory(r.from,r.to),repo.monthlyTrend(period==="year"?r.from:range("year").from,r.to)]);setSummary(Array.isArray(s) ? s : []);setCategories(Array.isArray(c) ? c : []);setTrend(Array.isArray(t) ? t : []);setError("");}catch(e){setError(e instanceof Error?e.message:"Unable to load reports.");}},[db,period]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 const currencyCodes=[...new Set((summary ?? []).map(x=>x.currencyCode))];
 return <SafeAreaView style={[s.safe,{backgroundColor:p.background}]} edges={["top","left","right"]}><View style={s.page}>
  <View style={s.header}><Pressable onPress={()=>router.back()} style={[s.back,{backgroundColor:p.surface,borderColor:p.border}]}><MaterialCommunityIcons name="arrow-left" size={21} color={p.text}/></Pressable><View style={{flex:1}}><Text style={[s.eyebrow,{color:p.primary}]}>FINANCIAL INSIGHTS</Text><Text style={[s.title,{color:p.text}]}>Reports</Text></View><Pressable onPress={()=>void load()}><MaterialCommunityIcons name="refresh" size={22} color={p.primary}/></Pressable></View>
  <View style={s.periods}>{(["month","quarter","year"] as Period[]).map(v=><Pressable key={v} onPress={()=>setPeriod(v)} style={[s.period,{backgroundColor:period===v?p.primary:p.surface,borderColor:period===v?p.primary:p.border}]}><Text style={{color:period===v?"#fff":p.text,fontWeight:"700",textTransform:"capitalize"}}>{v==="month"?"This month":v==="quarter"?"3 months":"This year"}</Text></Pressable>)}</View>
  <ScrollView contentContainerStyle={{gap:13,paddingBottom:32}}>
   {error?<Text style={{color:p.expense}}>{error}</Text>:null}
   {summary.length===0?<EmptyState icon="chart-box-outline" title="No financial activity yet" message="Record an expense or income to start seeing reports for this period." actionLabel="Log Expense" onAction={()=>router.push("/(tabs)/transactions")} palette={p} dark={dark} />:summary.map(x=><View key={x.currencyCode} style={[s.card,{backgroundColor:p.surface,borderColor:p.border}]}>
    <Text style={[s.section,{color:p.text}]}>{x.currencyCode} overview</Text>
    <View style={s.metric}><Text style={{color:p.textMuted}}>Income</Text><Text style={{color:p.income,fontWeight:"800"}}>{money(x.incomeMinor,x.currencyCode)}</Text></View>
    <View style={s.metric}><Text style={{color:p.textMuted}}>Expenses</Text><Text style={{color:p.expense,fontWeight:"800"}}>{money(x.expenseMinor,x.currencyCode)}</Text></View>
    <View style={[s.metric,{borderTopWidth:1,borderTopColor:p.border,paddingTop:11,marginTop:3}]}><Text style={{color:p.text,fontWeight:"800"}}>Net cash flow</Text><Text style={{color:x.netMinor>=0?p.income:p.expense,fontWeight:"900",fontSize:17}}>{money(x.netMinor,x.currencyCode)}</Text></View>
   </View>)}
   <Text style={[s.section,{color:p.text,marginTop:4}]}>Expense breakdown</Text>
   {categories.length===0?<Text style={{color:p.textMuted,fontSize:12}}>No expenses recorded for this period.</Text>:currencyCodes.map(currency=><View key={currency} style={[s.card,{backgroundColor:p.surface,borderColor:p.border}]}><Text style={[s.currency,{color:p.text}]}>{currency}</Text>{(categories ?? []).filter(x=>x.currencyCode===currency).slice(0,10).map(item=><View key={item.categoryName} style={{gap:5,marginTop:11}}><View style={s.metric}><Text style={{color:p.text,fontWeight:"600",flex:1}}>{item.categoryName}</Text><Text style={{color:p.text,fontWeight:"800"}}>{money(item.amountMinor,currency)}</Text></View><View style={[s.track,{backgroundColor:p.border}]}><View style={[s.fill,{backgroundColor:p.expense,width:(item.amountMinor/Math.max(1,categories.filter(x=>x.currencyCode===currency).reduce((sum,v)=>sum+v.amountMinor,0))*100)+"%"}]}/></View><Text style={{color:p.textMuted,fontSize:10}}>{item.transactionCount} transaction(s)</Text></View>)}</View>)}
   <Text style={[s.section,{color:p.text,marginTop:4}]}>Monthly trend</Text>
   {trend.length===0?<Text style={{color:p.textMuted,fontSize:12}}>No monthly activity available.</Text>:currencyCodes.map(currency=><View key={currency} style={[s.card,{backgroundColor:p.surface,borderColor:p.border}]}><Text style={[s.currency,{color:p.text}]}>{currency}</Text>{(trend ?? []).filter(x=>x.currencyCode===currency).map(item=><View key={item.month} style={{marginTop:10,gap:4}}><Text style={{color:p.textMuted,fontSize:11}}>{monthName(item.month)}</Text><View style={s.metric}><Text style={{color:p.income,fontSize:11}}>In {money(item.incomeMinor,currency)}</Text><Text style={{color:p.expense,fontSize:11}}>Out {money(item.expenseMinor,currency)}</Text></View></View>)}</View>)}
  </ScrollView>
 </View></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1},page:{flex:1,paddingHorizontal:18,paddingTop:14},header:{flexDirection:"row",alignItems:"center",gap:11,marginBottom:16},back:{width:40,height:40,borderRadius:13,borderWidth:1,alignItems:"center",justifyContent:"center"},eyebrow:{fontSize:10,fontWeight:"800",letterSpacing:1},title:{fontSize:27,fontWeight:"800",marginTop:2},periods:{flexDirection:"row",gap:7,marginBottom:14},period:{flex:1,alignItems:"center",paddingVertical:10,paddingHorizontal:5,borderRadius:12,borderWidth:1},card:{borderWidth:1,borderRadius:16,padding:15},section:{fontSize:15,fontWeight:"800"},metric:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:10,marginTop:11},currency:{fontSize:13,fontWeight:"800"},track:{height:7,borderRadius:8,overflow:"hidden"},fill:{height:7,borderRadius:8}});
