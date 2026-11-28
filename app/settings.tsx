import { useCallback, useState } from "react";
import Constants from "expo-constants";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { createBackupRepository } from "@/services/backup/backup-repository";
import { parseBackup } from "@/services/backup/backup-format";
import { useGoogleAuth } from "@/context/google-auth-context";
import { createSettingsRepository, DEFAULT_CURRENCY_CODE, SUPPORTED_DEFAULT_CURRENCIES, type DefaultCurrencyCode } from "@/database/repositories/settings-repository";
import { colors } from "@/theme/colors";
import { useThemePreference } from "@/context/theme-context";
import type { ThemePreference } from "@/database/repositories/settings-repository";
import { TransactionDataTools } from "@/components/settings/transaction-data-tools";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScreenBackButton } from "@/components/ui/screen-back-button";
import { BudgetNestBrand } from "@/components/ui/budgetnest-brand";
import { SelectField } from "@/components/ui/select-field";

const formatCount = (value: number) => new Intl.NumberFormat("en-PH").format(value);

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { preference, mode, setPreference } = useThemePreference();
  const dark = mode === "dark";
  const palette = dark ? colors.dark : colors.light;
  const { user, loading: authLoading, signingIn, signIn, signOut } = useGoogleAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState<DefaultCurrencyCode>(DEFAULT_CURRENCY_CODE);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [overview, setOverview] = useState<{ counts: Record<string, number>; schemaVersion: number } | null>(null);
  const [restoreText, setRestoreText] = useState<string | null>(null);
  const [restoreExportedAt, setRestoreExportedAt] = useState("");
  const [restoreAppVersion, setRestoreAppVersion] = useState("");
  const [restoreRecordCount, setRestoreRecordCount] = useState(0);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [expandedDataSection, setExpandedDataSection] = useState<"csv" | "technical" | null>(null);

  const changeThemePreference = async (next: ThemePreference) => {
    if (next === preference) return;
    setSavingTheme(true);
    setError("");
    try {
      await setPreference(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save your appearance preference.");
    } finally {
      setSavingTheme(false);
    }
  };

  const loadSettings = useCallback(async () => {
    try {
      const repository = createSettingsRepository(db);
      const [currency, data] = await Promise.all([
        repository.getDefaultCurrency(),
        repository.getDataOverview(),
      ]);
      setDefaultCurrency(currency);
      setOverview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load app settings.");
    }
  }, [db]);

  useFocusEffect(useCallback(() => { void loadSettings(); }, [loadSettings]));

  const changeDefaultCurrency = async (currency: DefaultCurrencyCode) => {
    if (currency === defaultCurrency) return;
    setError("");
    setSavingCurrency(true);
    try {
      await createSettingsRepository(db).setDefaultCurrency(currency);
      setDefaultCurrency(currency);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save your preference.");
    } finally {
      setSavingCurrency(false);
    }
  };

  const exportBackupToGoogle = async () => {
    setError("");
    setBusy(true);
    try {
      if (!user) await signIn();
      const json = await createBackupRepository(db, Constants.expoConfig?.version ?? "unknown").exportJson();
      const { uploadBackupToGoogleDrive } = await import("@/services/google/google-drive-service");
      await uploadBackupToGoogleDrive(json);
      Alert.alert("Backup complete", "Your BudgetNest backup was saved to your Google Drive app data.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save the backup to Google Drive.");
    } finally {
      setBusy(false);
    }
  };

  const selectGoogleRestore = async () => {
    setError("");
    setBusy(true);
    try {
      if (!user) await signIn();
      const { downloadLatestBackupFromGoogleDrive } = await import("@/services/google/google-drive-service");
      const text = await downloadLatestBackupFromGoogleDrive();
      if (!text) {
        setError("No BudgetNest backup was found in this Google account.");
        return;
      }

      const backup = parseBackup(text);
      setRestoreText(text);
      setRestoreExportedAt(backup.metadata.exportedAt);
      setRestoreAppVersion(backup.metadata.appVersion);
      setRestoreRecordCount(Object.values(backup.metadata.recordCounts).reduce((total, count) => total + count, 0));
      setConfirmRestore(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to read the Google Drive backup.");
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async () => {
    if (!restoreText) return;
    setError("");
    setBusy(true);
    try {
      await createBackupRepository(db, Constants.expoConfig?.version ?? "unknown").restoreJson(restoreText);
      await setPreference(await createSettingsRepository(db).getThemePreference());
      setConfirmRestore(false);
      setRestoreText(null);
      setRestoreExportedAt("");
      setRestoreAppVersion("");
      setRestoreRecordCount(0);
      await loadSettings();
      Alert.alert("Restore complete", "Your local BudgetNest data has been replaced with the selected Google backup.", [
        { text: "Continue", onPress: () => router.replace("/") },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to restore the Google backup.");
    } finally {
      setBusy(false);
    }
  };

  const totalRecords = overview
    ? Object.values(overview.counts).reduce((total, count) => total + count, 0)
    : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pageHeader}>
          <ScreenBackButton backgroundColor={palette.surface} borderColor={palette.border} color={palette.text} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: palette.primary }]}>PREFERENCES</Text>
            <Text style={[styles.title, { color: palette.text }]}>Settings</Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Simple controls for how BudgetNest looks and how your data is stored.
        </Text>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.appearanceHeader}>
            <View style={[styles.appearanceIcon, { backgroundColor: palette.primarySoft }]}>
              <MaterialCommunityIcons name="palette-outline" size={21} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Appearance</Text>
              <Text style={[styles.cardDescription, { color: palette.textMuted }]}>Choose how BudgetNest looks.</Text>
            </View>
          </View>
          <View style={styles.appearanceOptions}>
            {([
              { value: "system", label: "System", icon: "theme-light-dark" },
              { value: "light", label: "Light", icon: "white-balance-sunny" },
              { value: "dark", label: "Dark", icon: "moon-waning-crescent" },
            ] as const).map((option) => {
              const selected = preference === option.value;
              return (
                <Pressable key={option.value} disabled={savingTheme} onPress={() => void changeThemePreference(option.value)} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: savingTheme }} style={[styles.appearanceOption, { borderColor: selected ? palette.primary : palette.border, backgroundColor: selected ? (palette.primarySoft) : palette.surface }]}>
                  <MaterialCommunityIcons name={option.icon} size={19} color={selected ? palette.primary : palette.textMuted} />
                  <Text style={{ color: selected ? palette.primary : palette.text, fontSize: 11, fontWeight: "800", marginTop: 5 }}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.note, { color: palette.textMuted }]}>
            {preference === "system" ? "Following your device appearance. Currently " + mode + "." : (mode === "dark" ? "Dark" : "Light") + " appearance is saved on this device."}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Default currency</Text>
          <Text style={[styles.cardDescription, { color: palette.textMuted }]}>
            Starting currency for new accounts.
          </Text>
          <SelectField
            label="Preferred currency"
            value={defaultCurrency}
            options={SUPPORTED_DEFAULT_CURRENCIES.map(currency => ({ value: currency.code, label: currency.code, description: currency.label }))}
            onChange={value => void changeDefaultCurrency(value as DefaultCurrencyCode)}
            disabled={savingCurrency}
            placeholder="Select currency"
          />
          {savingCurrency ? <Text style={[styles.note, { color: palette.textMuted }]}>Saving preference…</Text> : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.googleHeader}>
            <View style={[styles.googleIcon, { backgroundColor: dark ? "#243447" : "#EEF5FF" }]}>
              <Text style={{ color: "#4285F4", fontSize: 18, fontWeight: "900" }}>G</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>GOOGLE DRIVE BACKUP (OPTIONAL)</Text>
              <Text style={[styles.cardTitle, { color: palette.text, marginTop: 4 }]}>
                {user ? "Connected" : "Not connected"}
              </Text>
              {user ? (
                <Text style={[styles.cardDescription, { color: palette.textMuted }]} numberOfLines={1}>
                  {user.user.email ?? user.user.id}
                </Text>
              ) : (
                <Text style={[styles.cardDescription, { color: palette.textMuted }]}>
                  Connect Google to back up or restore records.
                </Text>
              )}
            </View>
          </View>

          {!user ? (
            <Pressable
              disabled={authLoading || signingIn}
              onPress={() => { setError(""); void signIn().catch(e => setError(e instanceof Error ? e.message : "Unable to connect with Google.")); }}
              style={[styles.secondaryButton, { borderColor: palette.primary, opacity: authLoading || signingIn ? 0.6 : 1 }]}
            >
              <Text style={[styles.secondaryText, { color: palette.primary }]}>{signingIn ? "Connecting…" : "Connect with Google"}</Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={busy}
              onPress={() => void signOut()}
              style={[styles.secondaryButton, { borderColor: palette.border, opacity: busy ? 0.6 : 1 }]}
            >
              <Text style={[styles.secondaryText, { color: palette.text }]}>Sign out of Google</Text>
            </Pressable>
          )}

          <View style={styles.googleActions}>
            <Pressable
              disabled={busy || !user}
              onPress={() => void exportBackupToGoogle()}
              style={[styles.primaryButton, styles.halfButton, { backgroundColor: palette.primary, opacity: busy || !user ? 0.42 : 1 }]}
            >
              <Text style={[styles.primaryText, { color: palette.onPrimary }]}>{busy ? "Working…" : "Back up"}</Text>
            </Pressable>
            <Pressable
              disabled={busy || !user}
              onPress={() => void selectGoogleRestore()}
              style={[styles.secondaryButton, styles.halfButton, { borderColor: palette.border, opacity: busy || !user ? 0.42 : 1 }]}
            >
              <Text style={[styles.secondaryText, { color: palette.text }]}>Restore</Text>
            </Pressable>
          </View>

          <Text style={[styles.note, { color: palette.textMuted }]}>
            {user ? "Backup and restore replace the local records when restored." : "Connect Google to enable cloud backup and restore."}
          </Text>
        </View>

        <TransactionDataTools onImported={() => void loadSettings()} />

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>

          <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>YOUR DATA ON THIS DEVICE</Text>
          <Text style={[styles.dataSummary, { color: palette.text }]}>
            Records on this device: {overview ? formatCount(totalRecords) : "—"} · Local storage
          </Text>
          <Pressable onPress={() => setExpandedDataSection(expandedDataSection === "csv" ? null : "csv")} style={styles.expandRow}>
            <View style={{ flex: 1 }}><Text style={[styles.expandTitle, { color: palette.text }]}>CSV import rules & template</Text><Text style={[styles.expandHint, { color: palette.textMuted }]}>Columns, matching, duplicates, and limits</Text></View>
            <MaterialCommunityIcons name={expandedDataSection === "csv" ? "chevron-up" : "chevron-down"} size={20} color={palette.textMuted} />
          </Pressable>
          {expandedDataSection === "csv" ? <Text style={[styles.expandBody, { color: palette.textMuted }]}>Required columns: account_name, currency, transaction_type, amount, category, description, and transaction_date. Active accounts match by name and currency. Missing categories can be created; duplicates are skipped. Transfers are excluded. Maximum: 5 MB and 5,000 rows. Use the Share CSV import template action above.</Text> : null}
          <Pressable onPress={() => setExpandedDataSection(expandedDataSection === "technical" ? null : "technical")} style={styles.expandRow}>
            <View style={{ flex: 1 }}><Text style={[styles.expandTitle, { color: palette.text }]}>Technical details</Text><Text style={[styles.expandHint, { color: palette.textMuted }]}>Local SQLite and database version</Text></View>
            <MaterialCommunityIcons name={expandedDataSection === "technical" ? "chevron-up" : "chevron-down"} size={20} color={palette.textMuted} />
          </Pressable>
          {expandedDataSection === "technical" ? <View style={styles.expandBody}><Text style={[styles.expandLine, { color: palette.textMuted }]}>Storage: Local SQLite on this device</Text><Text style={[styles.expandLine, { color: palette.textMuted }]}>Records: {overview ? formatCount(totalRecords) : "—"}</Text><Text style={[styles.expandLine, { color: palette.textMuted }]}>Database version: {overview?.schemaVersion ?? "—"}</Text></View> : null}
        </View>

        {error ? (
          <View style={[styles.errorCard, { backgroundColor: palette.dangerSoft }]}>
            <Text style={[styles.errorTitle, { color: palette.primary }]}>Settings action failed</Text>
            <Text style={[styles.errorText, { color: palette.text }]}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={confirmRestore} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirmRestore(false); }}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.confirmCard, { backgroundColor: palette.surface }]}>
            <Text style={[styles.confirmTitle, { color: palette.text }]}>Restore this Google backup?</Text>
            <Text style={[styles.confirmText, { color: palette.textMuted }]}>
              This will replace the current local records with the selected Google backup.{"\n\n"}
              Backup date: {restoreExportedAt ? new Date(restoreExportedAt).toLocaleString() : "Unknown"}{"\n"}
              Backup app version: {restoreAppVersion || "Unknown"}{"\n"}
              Records included: {formatCount(restoreRecordCount)}{"\n\n"}
              The backup is integrity-checked before any data is changed.
            </Text>
            <View style={styles.actions}>
              <Pressable disabled={busy} onPress={() => setConfirmRestore(false)} style={[styles.cancelButton, { borderColor: palette.border }]}>
                <Text style={[styles.secondaryText, { color: palette.text }]}>Cancel</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={() => void restoreBackup()} style={[styles.dangerButton, { backgroundColor: palette.primary, opacity: busy ? 0.6 : 1 }]}>
                <Text style={[styles.primaryText, { color: palette.onPrimary }]}>{busy ? "Restoring…" : "Restore data"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40, gap: 14 },
  pageHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  title: { fontSize: 29, fontWeight: "800", marginTop: 1 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: -8, marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18 },
  cardTitle: { fontSize: 17, fontWeight: "800" },
  sectionLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  dataSummary: { fontSize: 13, fontWeight: "800", marginTop: 8 },
  cardDescription: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  googleHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  appearanceHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  appearanceIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  appearanceOptions: { flexDirection: "row", gap: 9, marginTop: 16 },
  appearanceOption: { flex: 1, minHeight: 68, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  googleIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  googleActions: { flexDirection: "row", gap: 9, marginTop: 10 },
  halfButton: { flex: 1 },
  note: { fontSize: 11, lineHeight: 17, marginTop: 12 },
  primaryButton: { padding: 15, borderRadius: 13, alignItems: "center", marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondaryButton: { padding: 15, borderRadius: 13, borderWidth: 1, alignItems: "center", marginTop: 10 },
  secondaryText: { fontWeight: "700" },
  expandRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(15, 23, 42, 0.08)", marginTop: 6 },
  expandTitle: { fontSize: 12, fontWeight: "800" },
  expandHint: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  expandBody: { fontSize: 11, lineHeight: 17, paddingBottom: 10, paddingTop: 2 },
  expandLine: { fontSize: 11, lineHeight: 18 },
  overviewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(15, 23, 42, 0.08)" },
  overviewLabel: { fontSize: 12 },
  overviewValue: { fontSize: 13, fontWeight: "800" },
  errorCard: { borderRadius: 14, padding: 14, marginTop: 12 },
  errorTitle: { fontSize: 13, fontWeight: "800" },
  errorText: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  dismissError: { marginTop: 8, alignSelf: "flex-start" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 20 },
  confirmCard: { width: "100%", maxWidth: 420, borderRadius: 20, padding: 20 },
  confirmTitle: { fontSize: 19, fontWeight: "800" },
  confirmText: { fontSize: 13, lineHeight: 20, marginTop: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  dangerButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
});