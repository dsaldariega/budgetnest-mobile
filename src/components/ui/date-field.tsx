import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState, useColorScheme } from "react";
import { colors } from "@/theme/colors";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function parseDate(value: string): Date {
  const parts = value.split("-").map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) return new Date(parts[0], parts[1] - 1, parts[2]);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function dateOnly(date: Date): string {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
}
function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function DateField({
  label, value, onChange, placeholder = "Select date", required = false, disabled = false,
}: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; disabled?: boolean;
}) {
  const dark = useColorScheme() === "dark";
  const p = dark ? colors.dark : colors.light;
  const [open, setOpen] = useState(false);
  const initial = parseDate(value);
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [mode, setMode] = useState<"calendar"|"months"|"years">("calendar");

  const moveMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewMonth(next.getMonth());
    setViewYear(next.getFullYear());
  };

  const openPicker = () => {
    const d = parseDate(value);
    setViewMonth(d.getMonth());
    setViewYear(d.getFullYear());
    setMode("calendar");
    setOpen(true);
  };
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const days = Array.from({ length: firstWeekday + daysInMonth }, (_, i) => i < firstWeekday ? null : i - firstWeekday + 1);
  const selected = value ? parseDate(value) : null;
  const years = Array.from({ length: 12 }, (_, i) => viewYear - 5 + i);

  return (
    <>
      <Text style={[s.label, { color: p.text }]}>{label}{required ? " *" : ""}</Text>
      <Pressable disabled={disabled} onPress={openPicker} style={[s.field, { backgroundColor: p.surface, borderColor: p.border, opacity: disabled ? 0.6 : 1 }]}>
        <Text style={{ flex: 1, color: value ? p.text : p.textMuted, fontSize: 14, fontWeight: value ? "700" : "500" }}>
          {value || placeholder}
        </Text>
        <MaterialCommunityIcons name="calendar-month-outline" size={20} color={p.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={[s.modal, { backgroundColor: p.background }]}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={[s.modalTitle, { color: p.text }]}>Select date</Text>
              <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 3 }}>Choose month, day, and year</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}><Text style={{ color: p.textMuted, fontWeight: "700" }}>Close</Text></Pressable>
          </View>

          {mode === "calendar" ? (
            <>
              <View style={s.calendarHeader}>
                <Pressable onPress={() => moveMonth(-1)} style={s.iconButton}><MaterialCommunityIcons name="chevron-left" size={21} color={p.text} /></Pressable>
                <View style={s.monthTitle}>
                  <Pressable onPress={() => setMode("months")}><Text style={[s.monthText, { color: p.text }]}>{MONTHS[viewMonth]}</Text></Pressable>
                  <Pressable onPress={() => setMode("years")}><Text style={[s.yearText, { color: p.primary }]}>{viewYear}</Text></Pressable>
                </View>
                <Pressable onPress={() => moveMonth(1)} style={s.iconButton}><MaterialCommunityIcons name="chevron-right" size={21} color={p.text} /></Pressable>
              </View>
              <View style={s.weekRow}>{WEEKDAYS.map(day => <Text key={day} style={[s.weekday, { color: p.textMuted }]}>{day}</Text>)}</View>
              <View style={s.grid}>
                {days.map((day, index) => {
                  if (day === null) return <View key={"blank-" + index} style={s.dayCell} />;
                  const candidate = new Date(viewYear, viewMonth, day);
                  const active = selected ? sameDate(candidate, selected) : false;
                  return <Pressable key={day} onPress={() => { onChange(dateOnly(candidate)); setOpen(false); }} style={[s.dayCell, active && { backgroundColor: p.primary }]}>
                    <Text style={{ color: active ? "#fff" : p.text, fontSize: 14, fontWeight: active ? "900" : "600" }}>{day}</Text>
                  </Pressable>;
                })}
              </View>
              <Pressable onPress={() => { const d = new Date(); setViewMonth(d.getMonth()); setViewYear(d.getFullYear()); }} style={s.todayButton}>
                <Text style={{ color: p.primary, fontSize: 12, fontWeight: "800" }}>Jump to today</Text>
              </Pressable>
            </>
          ) : mode === "months" ? (
            <View style={s.selectorGrid}>
              {MONTHS.map((month, index) => <Pressable key={month} onPress={() => { setViewMonth(index); setMode("calendar"); }} style={[s.selector, { backgroundColor: index === viewMonth ? (dark ? "#3A2424" : "#FCE8E8") : p.surface, borderColor: index === viewMonth ? p.primary : p.border }]}>
                <Text style={{ color: index === viewMonth ? p.primary : p.text, fontWeight: "700", fontSize: 12 }}>{month.slice(0,3)}</Text>
              </Pressable>)}
            </View>
          ) : (
            <>
              <View style={s.yearNav}>
                <Pressable onPress={() => setViewYear(y => y - 12)} style={s.iconButton}><MaterialCommunityIcons name="chevron-left" size={21} color={p.text} /></Pressable>
                <Text style={[s.monthText, { color: p.text }]}>{years[0]}–{years[11]}</Text>
                <Pressable onPress={() => setViewYear(y => y + 12)} style={s.iconButton}><MaterialCommunityIcons name="chevron-right" size={21} color={p.text} /></Pressable>
              </View>
              <View style={s.selectorGrid}>
                {years.map(year => <Pressable key={year} onPress={() => { setViewYear(year); setMode("calendar"); }} style={[s.selector, { backgroundColor: year === viewYear ? (dark ? "#3A2424" : "#FCE8E8") : p.surface, borderColor: year === viewYear ? p.primary : p.border }]}>
                  <Text style={{ color: year === viewYear ? p.primary : p.text, fontWeight: "700", fontSize: 12 }}>{year}</Text>
                </Pressable>)}
              </View>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "700", marginTop: 17, marginBottom: 8 },
  field: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  modal: { flex: 1, padding: 22 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 18 },
  modalTitle: { fontSize: 22, fontWeight: "900" },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  iconButton: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(100,116,139,0.08)" },
  monthTitle: { alignItems: "center", gap: 2 },
  monthText: { fontSize: 18, fontWeight: "900" },
  yearText: { fontSize: 12, fontWeight: "800" },
  weekRow: { flexDirection: "row", marginBottom: 5 },
  weekday: { width: "14.2857%", textAlign: "center", fontSize: 10, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  todayButton: { alignSelf: "center", padding: 13 },
  selectorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  selector: { width: "31%", minHeight: 48, borderWidth: 1, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  yearNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
});
