import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  createAccountRepository,
  getAccountDeleteImpactCount,
  type AccountDeleteImpact,
  type AccountWithBalance,
} from "@/database/repositories/account-repository";
import type { AccountType, CreateAccountInput } from "@/database/types";
import { toMinorUnits } from "@/domain/money";
import { createSettingsRepository } from "@/database/repositories/settings-repository";
import { colors } from "@/theme/colors";
import { ScreenBackButton } from "@/components/ui/screen-back-button";

const TYPES: { value: AccountType; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { value: "cash", label: "Cash", icon: "cash-multiple" },
  { value: "bank", label: "Bank account", icon: "bank-outline" },
  { value: "e_wallet", label: "E-wallet", icon: "cellphone" },
  { value: "credit_card", label: "Credit account", icon: "credit-card-outline" },
  { value: "investment", label: "Investment", icon: "chart-line" },
  { value: "other", label: "Other", icon: "wallet-outline" },
];

const makeId = () => `acc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const formatMoney = (amountMinor: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
  }
};

const emptyImpact: AccountDeleteImpact = {
  transactions: 0,
  budgets: 0,
  goals: 0,
  loans: 0,
  subscriptions: 0,
  recurringRules: 0,
};

export default function AccountsScreen() {
  const db = useSQLiteContext();
  const dark = useColorScheme() === "dark";
  const palette = dark ? colors.dark : colors.light;

  const [rows, setRows] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountWithBalance | null>(null);
  const [selected, setSelected] = useState<AccountWithBalance | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<AccountDeleteImpact>(emptyImpact);
  const [impactReady, setImpactReady] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [currency, setCurrency] = useState("PHP");
  const [opening, setOpening] = useState("0");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const repository = useMemo(() => createAccountRepository(db), [db]);
  const activeRows = rows.filter((account) => !account.isArchived);
  const visibleRows = showArchived ? rows : activeRows;
  const activeBalanceSummary = useMemo(() => {
    const currencies = new Set(activeRows.map((account) => account.currencyCode));
    if (currencies.size > 1) return "Multiple currencies";
    if (currencies.size === 0) return formatMoney(0, "PHP");
    const currencyCode = activeRows[0].currencyCode;
    const total = activeRows.reduce((sum, account) => sum + account.balanceMinor, 0);
    return formatMoney(total, currencyCode);
  }, [activeRows]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await repository.listAll());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load accounts.");
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const resetForm = () => {
    setName("");
    setType("cash");
    setCurrency("PHP");
    setOpening("0");
    setError("");
  };

  const openCreate = async () => {
    setEditing(null);
    resetForm();
    try {
      setCurrency(await createSettingsRepository(db).getDefaultCurrency());
    } catch {
      setCurrency("PHP");
    }
    setFormOpen(true);
  };

  const openEdit = (account: AccountWithBalance) => {
    setEditing(account);
    setName(account.name);
    setType(account.type);
    setCurrency(account.currencyCode);
    setOpening((account.openingBalanceMinor / 100).toFixed(2));
    setError("");
    setSelected(null);
    setFormOpen(true);
  };

  const save = async () => {
    setError("");
    const amount = Number(opening.trim() || "0");
    if (!name.trim()) {
      setError("Enter an account name.");
      return;
    }
    if (!Number.isFinite(amount)) {
      setError("Enter a valid starting balance.");
      return;
    }

    setSaving(true);
    try {
      const input: CreateAccountInput = {
        id: editing?.id ?? makeId(),
        name,
        type,
        sourceType: editing?.sourceType ?? null,
        currencyCode: editing?.currencyCode ?? currency,
        openingBalanceMinor: toMinorUnits(amount),
      };

      if (editing) await repository.update(editing.id, input);
      else await repository.create(input);

      setFormOpen(false);
      setEditing(null);
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save account.");
    } finally {
      setSaving(false);
    }
  };

  const openActions = async (account: AccountWithBalance) => {
    setSelected(account);
    setDeleteImpact(emptyImpact);
    setImpactReady(false);
    try {
      setDeleteImpact(await repository.getDeleteImpact(account.id));
      setImpactReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to inspect account history.");
    }
  };

  const toggleArchive = async () => {
    if (!selected) return;
    const account = selected;
    setSaving(true);
    try {
      await repository.setArchived(account.id, !account.isArchived);
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update account status.");
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = () => {
    if (!selected) return;
    const account = selected;
    if (!impactReady || getAccountDeleteImpactCount(deleteImpact) > 0) return;

    Alert.alert(
      "Delete this account?",
      `“${account.name}” will be permanently deleted. This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              await repository.delete(account.id);
              setSelected(null);
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Unable to delete account.");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const dependencyLabels = [
    ["transactions", "Transactions"],
    ["budgets", "Budgets"],
    ["goals", "Savings goals"],
    ["loans", "Loans"],
    ["subscriptions", "Subscriptions"],
    ["recurringRules", "Recurring schedules"],
  ] as const;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <ScreenBackButton backgroundColor={palette.surface} borderColor={palette.border} color={palette.text} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: palette.primary }]}>YOUR MONEY</Text>
            <Text style={[styles.title, { color: palette.text }]}>Accounts</Text>
          </View>
          {activeRows.length > 0 ? (
            <Pressable onPress={() => void openCreate()} style={[styles.addButton, { backgroundColor: palette.primary }]}>
              <MaterialCommunityIcons name="plus" size={18} color="#fff" />
              <Text style={styles.addButtonText}>Add account</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Keep your cash, bank accounts, and e-wallets organized in one place.
        </Text>

        {activeRows.length > 0 ? (
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>ACTIVE ACCOUNTS</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>{activeRows.length}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>CURRENT BALANCE</Text>
              <Text style={[styles.summaryBalance, { color: palette.text }]}>{activeBalanceSummary}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.listHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Your accounts</Text>
            <Text style={[styles.listCaption, { color: palette.textMuted }]}>
              {visibleRows.length} {visibleRows.length === 1 ? "account" : "accounts"} shown
            </Text>
          </View>
          <Pressable onPress={() => setShowArchived((value) => !value)} style={styles.filterButton}>
            <MaterialCommunityIcons name="archive-outline" size={16} color={palette.primary} />
            <Text style={[styles.filterText, { color: palette.primary }]}>
              {showArchived ? "Hide archived" : "Show archived"}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={[styles.empty, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={{ color: palette.textMuted }}>Loading accounts…</Text>
          </View>
        ) : visibleRows.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}>
              <MaterialCommunityIcons name="wallet-outline" size={28} color={palette.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: palette.text }]}>
              {showArchived ? "No archived accounts" : "Start with your first account"}
            </Text>
            <Text style={[styles.emptyText, { color: palette.textMuted }]}>
              {showArchived
                ? "Accounts you archive will appear here."
                : "Add the places where you keep your money. You can connect transactions, budgets, and goals to an account later."}
            </Text>
            {!showArchived ? (
              <Pressable onPress={() => void openCreate()} style={[styles.primaryButton, { backgroundColor: palette.primary }]}>
                <Text style={styles.primaryButtonText}>Add your first account</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {visibleRows.map((account) => {
              const accountType = TYPES.find((item) => item.value === account.type);
              return (
                <View
                  key={account.id}
                  style={[
                    styles.accountCard,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      opacity: account.isArchived ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={styles.accountTop}>
                    <View style={[styles.accountIcon, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}>
                      <MaterialCommunityIcons name={(accountType?.icon ?? "wallet-outline") as never} size={22} color={palette.primary} />
                    </View>
                    <View style={styles.accountCopy}>
                      <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                        {account.name}
                      </Text>
                      <Text style={[styles.accountMeta, { color: palette.textMuted }]}>
                        {accountType?.label ?? "Other"} · {account.currencyCode}
                      </Text>
                    </View>
                    {account.isArchived ? (
                      <View style={[styles.archivedPill, { backgroundColor: palette.background }]}>
                        <Text style={[styles.archivedText, { color: palette.textMuted }]}>Archived</Text>
                      </View>
                    ) : null}
                    <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${account.name}`} onPress={() => void openActions(account)} hitSlop={10} style={styles.moreButton}>
                      <MaterialCommunityIcons name="dots-horizontal" size={22} color={palette.textMuted} />
                    </Pressable>
                  </View>

                  <View style={[styles.balanceDivider, { backgroundColor: palette.border }]} />
                  <Text style={[styles.balanceLabel, { color: palette.textMuted }]}>CURRENT BALANCE</Text>
                  <Text style={[styles.balance, { color: palette.text }]}>{formatMoney(account.balanceMinor, account.currencyCode)}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormOpen(false)}>
        <SafeAreaView style={[styles.modal, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: palette.text }]}>{editing ? "Edit account" : "Add an account"}</Text>
                <Text style={[styles.modalSubtitle, { color: palette.textMuted }]}>
                  {editing ? "Update the account details shown in your records." : "Add a place where you keep or manage your money."}
                </Text>
              </View>
              <Pressable onPress={() => setFormOpen(false)} disabled={saving} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={23} color={palette.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.fieldLabel, { color: palette.text }]}>Account name</Text>
            <TextInput value={name} onChangeText={setName} maxLength={80} placeholder="e.g. Main Savings, GCash, Wallet" placeholderTextColor={palette.textMuted} style={[styles.input, { color: palette.text, backgroundColor: palette.surface, borderColor: palette.border }]} />

            <Text style={[styles.fieldLabel, { color: palette.text }]}>Account type</Text>
            <View style={styles.chips}>
              {TYPES.map((item) => {
                const active = type === item.value;
                return (
                  <Pressable key={item.value} onPress={() => setType(item.value)} style={[styles.chip, { borderColor: active ? palette.primary : palette.border, backgroundColor: active ? (dark ? "#3A2424" : "#FCE8E8") : palette.surface }]}>
                    <Text style={{ color: active ? palette.primary : palette.text, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: palette.text }]}>Currency code</Text>
            <TextInput value={currency} onChangeText={setCurrency} editable={!editing} autoCapitalize="characters" maxLength={3} placeholder="PHP" placeholderTextColor={palette.textMuted} style={[styles.input, { color: palette.text, backgroundColor: palette.surface, borderColor: palette.border, opacity: editing ? 0.65 : 1 }]} />
            {editing ? <Text style={[styles.helperText, { color: palette.textMuted }]}>Currency is kept unchanged so existing transactions retain their original value.</Text> : null}

            <Text style={[styles.fieldLabel, { color: palette.text }]}>Starting balance</Text>
            <TextInput value={opening} onChangeText={setOpening} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={palette.textMuted} style={[styles.input, styles.amountInput, { color: palette.text, backgroundColor: palette.surface, borderColor: palette.border }]} />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable disabled={saving} onPress={() => void save()} style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: saving ? 0.6 : 1 }]}>
              <Text style={styles.primaryButtonText}>{saving ? "Saving…" : editing ? "Save changes" : "Save account"}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={Boolean(selected)} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable onPress={() => undefined} style={[styles.actionSheet, { backgroundColor: palette.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: palette.border }]} />
            <Text style={[styles.sheetTitle, { color: palette.text }]}>{selected?.name}</Text>
            <Text style={[styles.sheetSubtitle, { color: palette.textMuted }]}>Account actions</Text>

            <Pressable disabled={saving} onPress={() => selected && openEdit(selected)} style={styles.sheetAction}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={palette.primary} />
              <Text style={[styles.sheetActionText, { color: palette.text }]}>Edit account</Text>
            </Pressable>

            <Pressable disabled={saving} onPress={() => void toggleArchive()} style={styles.sheetAction}>
              <MaterialCommunityIcons name={selected?.isArchived ? "archive-arrow-up-outline" : "archive-outline"} size={20} color={palette.textMuted} />
              <Text style={[styles.sheetActionText, { color: palette.text }]}>{selected?.isArchived ? "Restore account" : "Archive account"}</Text>
            </Pressable>

            <View style={[styles.impactBox, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Text style={[styles.impactTitle, { color: palette.text }]}>Linked financial records</Text>
              {dependencyLabels.map(([key, label]) => {
                const count = deleteImpact[key];
                if (!count) return null;
                return <Text key={key} style={[styles.impactText, { color: palette.textMuted }]}>{count} {label.toLowerCase()}</Text>;
              })}
              {!impactReady ? (
                <Text style={[styles.impactText, { color: palette.textMuted }]}>Checking linked records…</Text>
              ) : getAccountDeleteImpactCount(deleteImpact) === 0 ? (
                <Text style={[styles.impactText, { color: palette.success }]}>No linked records. This account can be deleted.</Text>
              ) : (
                <Text style={[styles.impactText, { color: palette.textMuted }]}>Delete is unavailable while records are linked. Archive the account to keep its history safe.</Text>
              )}
            </View>

            <Pressable disabled={saving || !impactReady || getAccountDeleteImpactCount(deleteImpact) > 0} onPress={deleteAccount} style={[styles.sheetAction, { opacity: !impactReady || getAccountDeleteImpactCount(deleteImpact) > 0 ? 0.4 : 1 }]}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={palette.expense} />
              <Text style={[styles.sheetActionText, { color: palette.expense }]}>Delete account</Text>
            </Pressable>
            <Pressable onPress={() => setSelected(null)} style={[styles.sheetDone, { borderColor: palette.border }]}>
              <Text style={[styles.sheetDoneText, { color: palette.text }]}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  eyebrow: { color: "#D32F2F", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  title: { fontSize: 29, fontWeight: "800", marginTop: 4 },
  addButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12 },
  addButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 17 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 21 },
  summaryCard: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 14, padding: 13, gap: 5 },
  summaryLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  summaryValue: { fontSize: 23, fontWeight: "900" },
  summaryBalance: { fontSize: 15, fontWeight: "900" },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  listCaption: { fontSize: 11, marginTop: 3 },
  filterButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingLeft: 8 },
  filterText: { fontSize: 11, fontWeight: "800" },
  list: { gap: 11, paddingBottom: 30 },
  accountCard: { borderWidth: 1, borderRadius: 17, padding: 15 },
  accountTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  accountIcon: { width: 43, height: 43, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  accountCopy: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: "800" },
  accountMeta: { fontSize: 11 },
  archivedPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  archivedText: { fontSize: 9, fontWeight: "800" },
  moreButton: { padding: 3 },
  balanceDivider: { height: StyleSheet.hairlineWidth, marginVertical: 13 },
  balanceLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  balance: { fontSize: 22, fontWeight: "900", marginTop: 4 },
  empty: { borderWidth: 1, borderRadius: 18, padding: 23, alignItems: "center", marginTop: 5 },
  emptyIcon: { width: 54, height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyText: { textAlign: "center", fontSize: 12, lineHeight: 19, marginTop: 7 },
  primaryButton: { paddingHorizontal: 17, paddingVertical: 13, borderRadius: 13, alignItems: "center", marginTop: 17 },
  primaryButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  modal: { flex: 1 },
  form: { padding: 21, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 8 },
  modalTitle: { fontSize: 22, fontWeight: "900" },
  modalSubtitle: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  fieldLabel: { fontSize: 12, fontWeight: "800", marginTop: 17, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14 },
  amountInput: { fontSize: 19, fontWeight: "800" },
  helperText: { fontSize: 10, lineHeight: 15, marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9 },
  error: { color: "#D32F2F", fontSize: 12, marginTop: 12 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.42)" },
  actionSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  sheetHandle: { width: 38, height: 4, borderRadius: 4, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: "900" },
  sheetSubtitle: { fontSize: 11, marginTop: 3, marginBottom: 12 },
  sheetAction: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  sheetActionText: { fontSize: 13, fontWeight: "700" },
  impactBox: { borderWidth: 1, borderRadius: 13, padding: 12, marginVertical: 9, gap: 4 },
  impactTitle: { fontSize: 11, fontWeight: "900", marginBottom: 2 },
  impactText: { fontSize: 10, lineHeight: 15 },
  sheetDone: { borderWidth: 1, borderRadius: 12, alignItems: "center", paddingVertical: 12, marginTop: 8 },
  sheetDoneText: { fontSize: 12, fontWeight: "800" },
});
