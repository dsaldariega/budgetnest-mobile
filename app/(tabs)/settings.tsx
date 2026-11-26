import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { createBackupRepository } from "@/services/backup/backup-repository";
import { parseBackup } from "@/services/backup/backup-format";
import { pickBackupFile, shareBackupFile, writeBackupFile } from "@/services/backup/backup-file-service";
import { colors } from "@/theme/colors";

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const dark = useColorScheme() === "dark";
  const palette = dark ? colors.dark : colors.light;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restoreText, setRestoreText] = useState<string | null>(null);
  const [restoreExportedAt, setRestoreExportedAt] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(false);

  const exportBackup = async () => {
    setError("");
    setBusy(true);
    try {
      const json = await createBackupRepository(db).exportJson();
      const exportedAt = JSON.parse(json).metadata.exportedAt as string;
      const uri = await writeBackupFile(json, exportedAt);
      await shareBackupFile(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to export the backup.");
    } finally {
      setBusy(false);
    }
  };

  const selectRestoreFile = async () => {
    setError("");
    setBusy(true);
    try {
      const text = await pickBackupFile();
      if (!text) return;

      const backup = parseBackup(text);
      setRestoreText(text);
      setRestoreExportedAt(backup.metadata.exportedAt);
      setConfirmRestore(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to read the selected backup.");
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async () => {
    if (!restoreText) return;

    setError("");
    setBusy(true);
    try {
      await createBackupRepository(db).restoreJson(restoreText);
      setConfirmRestore(false);
      setRestoreText(null);
      setRestoreExportedAt("");
      Alert.alert(
        "Restore complete",
        "Your local BudgetNest data has been replaced with the selected backup.",
        [{ text: "Continue", onPress: () => router.replace("/") }],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to restore the backup.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: palette.primary }]}>PREFERENCES</Text>
        <Text style={[styles.title, { color: palette.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Keep your local data safe and manage how BudgetNest is stored on this device.
        </Text>

        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Backup & Restore</Text>
          <Text style={[styles.cardDescription, { color: palette.textMuted }]}>
            Export a portable JSON backup or replace the current local database with a backup you already have.
          </Text>

          <Pressable
            testID="settings-export-backup"
            disabled={busy}
            onPress={() => void exportBackup()}
            style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={styles.primaryText}>{busy ? "Working…" : "Export backup"}</Text>
          </Pressable>

          <Pressable
            testID="settings-restore-backup"
            disabled={busy}
            onPress={() => void selectRestoreFile()}
            style={[styles.secondaryButton, { borderColor: palette.border, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={[styles.secondaryText, { color: palette.text }]}>Restore backup</Text>
          </Pressable>

          <Text style={[styles.note, { color: palette.textMuted }]}>
            Restore replaces the current local data. It does not sync with the cloud.
          </Text>
        </View>

        {error ? (
          <View style={[styles.errorCard, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}>
            <Text style={[styles.errorTitle, { color: palette.primary }]}>Backup action failed</Text>
            <Text style={[styles.errorText, { color: palette.text }]}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={confirmRestore}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setConfirmRestore(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.confirmCard, { backgroundColor: palette.surface }]}>
            <Text style={[styles.confirmTitle, { color: palette.text }]}>Restore this backup?</Text>
            <Text style={[styles.confirmText, { color: palette.textMuted }]}>
              This will delete the current local records and replace them with the selected backup.
              {"\n\n"}Backup date: {restoreExportedAt ? new Date(restoreExportedAt).toLocaleString() : "Unknown"}
              {"\n\n"}This action cannot be undone unless you have another backup.
            </Text>

            <View style={styles.actions}>
              <Pressable
                disabled={busy}
                onPress={() => setConfirmRestore(false)}
                style={[styles.cancelButton, { borderColor: palette.border }]}
              >
                <Text style={[styles.secondaryText, { color: palette.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                testID="settings-confirm-restore"
                disabled={busy}
                onPress={() => void restoreBackup()}
                style={[styles.dangerButton, { backgroundColor: palette.primary, opacity: busy ? 0.6 : 1 }]}
              >
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
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  title: { fontSize: 29, fontWeight: "800", marginTop: 4 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18 },
  cardTitle: { fontSize: 17, fontWeight: "800" },
  cardDescription: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  primaryButton: { borderRadius: 13, paddingVertical: 14, alignItems: "center", marginTop: 18 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  secondaryButton: { borderWidth: 1, borderRadius: 13, paddingVertical: 14, alignItems: "center", marginTop: 10 },
  secondaryText: { fontWeight: "700", fontSize: 14 },
  note: { fontSize: 11, lineHeight: 17, marginTop: 13 },
  errorCard: { borderRadius: 15, padding: 15, marginTop: 14 },
  errorTitle: { fontSize: 12, fontWeight: "800" },
  errorText: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.48)", justifyContent: "center", padding: 22 },
  confirmCard: { borderRadius: 20, padding: 20 },
  confirmTitle: { fontSize: 20, fontWeight: "800" },
  confirmText: { fontSize: 13, lineHeight: 20, marginTop: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelButton: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  dangerButton: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
});
