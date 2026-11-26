import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useColorScheme } from "react-native";
import { useState } from "react";
import { colors } from "@/theme/colors";

export type SelectOption = { value: string; label: string; description?: string };

export function SelectField({
  label,
  value,
  options,
  placeholder = "Select",
  onChange,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const dark = useColorScheme() === "dark";
  const p = dark ? colors.dark : colors.light;
  const [selected] = options.filter(option => option.value === value);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Text style={[s.label, { color: p.text }]}>{label}{required ? " *" : ""}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[s.field, { backgroundColor: p.surface, borderColor: p.border, opacity: disabled ? 0.6 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: selected ? p.text : p.textMuted, fontSize: 14, fontWeight: selected ? "700" : "500" }}>
            {selected?.label ?? placeholder}
          </Text>
          {selected?.description ? <Text style={{ color: p.textMuted, fontSize: 10, marginTop: 3 }}>{selected.description}</Text> : null}
        </View>
        <MaterialCommunityIcons name="chevron-down" size={20} color={p.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={[s.modal, { backgroundColor: p.background }]}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={[s.modalTitle, { color: p.text }]}>{label}</Text>
              <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 3 }}>Choose one option</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Text style={{ color: p.textMuted, fontWeight: "700" }}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.options}>
            {options.length === 0 ? (
              <View style={[s.empty, { backgroundColor: p.surface, borderColor: p.border }]}>
                <Text style={{ color: p.textMuted, fontSize: 13 }}>No options available.</Text>
              </View>
            ) : options.map(option => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => { onChange(option.value); setOpen(false); }}
                  style={[s.option, { backgroundColor: active ? (dark ? "#3A2424" : "#FCE8E8") : p.surface, borderColor: active ? p.primary : p.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: active ? p.primary : p.text, fontSize: 14, fontWeight: "700" }}>{option.label}</Text>
                    {option.description ? <Text style={{ color: p.textMuted, fontSize: 11, marginTop: 4 }}>{option.description}</Text> : null}
                  </View>
                  {active ? <MaterialCommunityIcons name="check" size={20} color={p.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}


const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "700", marginTop: 17, marginBottom: 8 },
  field: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  modal: { flex: 1, padding: 22 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  modalTitle: { fontSize: 22, fontWeight: "900" },
  options: { gap: 9, paddingBottom: 30 },
  option: { minHeight: 58, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  empty: { borderWidth: 1, borderRadius: 14, padding: 18 },
});
