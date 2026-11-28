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
          Manage appearance, currency, transaction files, and optional Google backup.
        </Text>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={styles.appearanceHeader}>
            <View style={[styles.appearanceIcon, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}>
              <MaterialCommunityIcons name="palette-outline" size={21} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Appearance</Text>
              <Text style={[styles.cardDescription, { color: palette.textMuted }]}>Choose how BudgetNest looks on this device.</Text>
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
                <Pressable key={option.value} disabled={savingTheme} onPress={() => void changeThemePreference(option.value)} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: savingTheme }} style={[styles.appearanceOption, { borderColor: selected ? palette.primary : palette.border, backgroundColor: selected ? (dark ? "#3A2424" : "#FCE8E8") : palette.surface }]}>
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
            Used as the starting currency when you create a new account. Existing balances are not converted.
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
              <Text style={[styles.cardTitle, { color: palette.text }]}>Google account</Text>
              <Text style={[styles.cardDescription, { color: palette.textMuted }]}>
                {user ? "Connected as " + (user.user.email ?? user.user.id) : "Optional. Sign in only when you want cloud backup."}
              </Text>
            </View>
          </View>

          {!user ? (
            <Pressable
              disabled={authLoading || signingIn}
              onPress={() => { setError(""); void signIn().catch(e => setError(e instanceof Error ? e.message : "Unable to connect with Google.")); }}
              style={[styles.secondaryButton, { borderColor: palette.border, opacity: authLoading || signingIn ? 0.6 : 1 }]}
            >
              <Text style={[styles.secondaryText, { color: palette.text }]}>{signingIn ? "Connecting…" : "Connect with Google"}</Text>
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

          <Text style={[styles.note, { color: palette.textMuted }]}>
            BudgetNest remains fully usable without a Google account. Google access is only used for the optional backup and restore feature.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Google Backup & Restore</Text>
          <Text style={[styles.cardDescription, { color: palette.textMuted }]}>
            {user
              ? "Store one private BudgetNest backup in your Google Drive app data and restore it on another signed-in device."
              : "Connect your Google account to unlock cloud backup and restore. Your local data stays available without signing in."}
          </Text>
          <Pressable
            disabled={busy}
            onPress={() => void exportBackupToGoogle()}
            style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={styles.primaryText}>{busy ? "Working…" : "Back up to Google Drive"}</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => void selectGoogleRestore()}
            style={[styles.secondaryButton, { borderColor: palette.border, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={[styles.secondaryText, { color: palette.text }]}>Restore from Google Drive</Text>
          </Pressable>
          <Text style={[styles.note, { color: palette.textMuted }]}>
            {user
              ? "Backup and restore use the existing integrity-checked JSON format. Restoring replaces the current local data."
              : "Sign-in is only requested when you choose one of these cloud features."}
          </Text>
        </View>

        <TransactionDataTools onImported={() => void loadSettings()} />

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Data on this device</Text>
          <Text style={[styles.cardDescription, { color: palette.textMuted }]}>
            A quick overview of records currently stored in your local database.
          </Text>
          <View style={styles.overviewRow}><Text style={[styles.overviewLabel, { color: palette.textMuted }]}>Total records</Text><Text style={[styles.overviewValue, { color: palette.text }]}>{overview ? formatCount(totalRecords) : "—"}</Text></View>
          <View style={styles.overviewRow}><Text style={[styles.overviewLabel, { color: palette.textMuted }]}>Database version</Text><Text style={[styles.overviewValue, { color: palette.text }]}>{overview?.schemaVersion ?? "—"}</Text></View>
          <View style={styles.overviewRow}><Text style={[styles.overviewLabel, { color: palette.textMuted }]}>Storage</Text><Text style={[styles.overviewValue, { color: palette.text }]}>This device only</Text></View>
        </View>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <BudgetNestBrand color={palette.text} size={38} />
          <Text style={[styles.cardDescription, { color: palette.textMuted }]}>
            A private, local-first personal finance tracker. No account or cloud connection is required for normal use.
          </Text>
        </View>

        {error ? (
          <View style={[styles.errorCard, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}>
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
                <Text style={styles.primaryText}>{busy ? "Restoring…" : "Restore data"}</Text>
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
  cardDescription: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  googleHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  appearanceHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  appearanceIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  appearanceOptions: { flexDirection: "row", gap: 9, marginTop: 16 },
  appearanceOption: { flex: 1, minHeight: 68, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  googleIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  note: { fontSize: 11, lineHeight: 17, marginTop: 12 },
  primaryButton: { padding: 15, borderRadius: 13, alignItems: "center", marginTop: 16 },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondaryButton: { padding: 15, borderRadius: 13, borderWidth: 1, alignItems: "center", marginTop: 10 },
  secondaryText: { fontWeight: "700" },
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
