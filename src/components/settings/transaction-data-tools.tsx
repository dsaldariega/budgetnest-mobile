import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useSQLiteContext } from "expo-sqlite";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createTransactionCsvRepository } from "@/database/repositories/transaction-csv-repository";
import {
  getExportDateRange,
  localDateStamp,
  makeTransactionCsv,
  normalizeImportCsv,
  type CsvExportRow,
  type ExportPeriod,
} from "@/services/csv/transaction-csv";
import { colors } from "@/theme/colors";
import { todayLocalDate } from "@/domain/dates";
import { DateField } from "@/components/ui/date-field";

const todayLocal = todayLocalDate;

const PERIODS: { value: ExportPeriod; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom" },
];

async function shareCsvFile(filename: string, content: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("File sharing is not available on this device.");
  }
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error("Unable to access temporary file storage.");

  const uri = directory + filename;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(uri, {
    mimeType: "text/csv",
    dialogTitle: "Share BudgetNest CSV",
    UTI: "public.comma-separated-values-text",
  });
}

export function TransactionDataTools({ onImported }: { onImported?: () => void }) {
  const db = useSQLiteContext();
  const dark = useColorScheme() === "dark";
  const palette = dark ? colors.dark : colors.light;
  const repository = createTransactionCsvRepository(db);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportRows, setExportRows] = useState<CsvExportRow[]>([]);
  const [period, setPeriod] = useState<ExportPeriod>("all");
  const [transactionType, setTransactionType] = useState<"both" | "income" | "expense">("both");
  const [category, setCategory] = useState("all");
  const [startDate, setStartDate] = useState(todayLocal);
  const [endDate, setEndDate] = useState(todayLocalDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const dateRange = useMemo(
    () => getExportDateRange(period, startDate, endDate),
    [period, startDate, endDate],
  );
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00.000Z")) &&
    new Date(value + "T00:00:00.000Z").toISOString().slice(0, 10) === value;
  const dateInvalid = period === "custom" &&
    (!validDate(startDate) || !validDate(endDate) || endDate < startDate);

  const categories = useMemo(
    () => Array.from(new Set(exportRows.map((row) => row.categoryName ?? "Uncategorised"))).sort(),
    [exportRows],
  );

  const filteredRows = useMemo(() => exportRows.filter((row) => {
    const date = row.occurredAt.slice(0, 10);
    const matchesType = transactionType === "both" || row.type === transactionType;
    const rowCategory = row.categoryName ?? "Uncategorised";
    const matchesCategory = category === "all" || rowCategory === category;
    const matchesDate = (!dateRange.start || date >= dateRange.start) &&
      (!dateRange.end || date <= dateRange.end);
    return matchesType && matchesCategory && matchesDate;
  }), [exportRows, transactionType, category, dateRange]);

  const openExport = async () => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      setExportRows(await repository.listForExport());
      setCategory("all");
      setExportOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to prepare transaction export.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    if (dateInvalid || filteredRows.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const filename = "budgetnest-transactions-" + localDateStamp() + ".csv";
      await shareCsvFile(filename, makeTransactionCsv(filteredRows));
      setExportOpen(false);
      setNotice("Your filtered transaction CSV is ready to share or save.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to export transactions.");
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async () => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const selection = await DocumentPicker.getDocumentAsync({
        type: "text/csv",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (selection.canceled || !selection.assets[0]) return;

      const asset = selection.assets[0];
      if (asset.size !== undefined && asset.size > 5 * 1024 * 1024) {
        throw new Error("Please choose a CSV file smaller than 5 MB.");
      }
      const raw = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (raw.length > 5 * 1024 * 1024) {
        throw new Error("Please choose a CSV file smaller than 5 MB.");
      }

      const rows = normalizeImportCsv(raw);
      const result = await repository.importRows(rows);
      setNotice(
        "Imported " + result.imported + " transaction(s); skipped " +
        result.skippedDuplicates + " duplicate(s).",
      );
      onImported?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to import this CSV file.");
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    setError("");
    try {
      await shareCsvFile(
        "budgetnest-transaction-import-template.csv",
        "\uFEFFaccount_name,currency,transaction_type,amount,category,description,transaction_date\r\n",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to prepare the CSV template.");
    }
  };

  const chipStyle = (selected: boolean) => [
    styles.chip,
    {
      backgroundColor: selected ? (dark ? "#3A2424" : "#FCE8E8") : palette.surface,
      borderColor: selected ? palette.primary : palette.border,
    },
  ];

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.heading}>
        <View style={[styles.headingIcon, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}>
          <MaterialCommunityIcons name="file-delimited-outline" size={22} color={palette.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>Transaction data</Text>
          <Text style={[styles.description, { color: palette.textMuted }]}>
            Export or import your income and expense records as CSV files.
          </Text>
        </View>
      </View>

      <View style={styles.toolRow}>
        <Pressable disabled={busy} onPress={() => void openExport()} style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: busy ? 0.6 : 1 }]}>
          <MaterialCommunityIcons name="download-outline" size={18} color="#fff" />
          <Text style={styles.primaryText}>{busy ? "Working…" : "Export CSV"}</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={() => void importCsv()} style={[styles.secondaryButton, { borderColor: palette.border, opacity: busy ? 0.6 : 1 }]}>
          <MaterialCommunityIcons name="upload-outline" size={18} color={palette.primary} />
          <Text style={[styles.secondaryText, { color: palette.text }]}>Import CSV</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => void downloadTemplate()} style={styles.templateButton}>
        <MaterialCommunityIcons name="file-download-outline" size={16} color={palette.primary} />
        <Text style={[styles.templateText, { color: palette.primary }]}>Share CSV import template</Text>
      </Pressable>

      {notice ? (
        <View style={[styles.message, { backgroundColor: dark ? "#203528" : "#E8F5E9" }]}>
          <Text style={{ color: palette.success, fontSize: 12, lineHeight: 18 }}>{notice}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.message, { backgroundColor: dark ? "#3A2424" : "#FCE8E8" }]}>
          <Text style={{ color: palette.expense, fontSize: 12, lineHeight: 18 }}>{error}</Text>
        </View>
      ) : null}

      <Modal visible={exportOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) setExportOpen(false); }}>
        <SafeAreaView style={[styles.modal, { backgroundColor: palette.background }]} edges={["top", "left", "right"]}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: palette.text }]}>Export transactions</Text>
                <Text style={[styles.description, { color: palette.textMuted }]}>Choose which income and expense records to include.</Text>
              </View>
              <Pressable disabled={busy} onPress={() => setExportOpen(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={23} color={palette.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.label, { color: palette.text }]}>Date range</Text>
            <View style={styles.chips}>
              {PERIODS.map((item) => (
                <Pressable key={item.value} onPress={() => setPeriod(item.value)} style={chipStyle(period === item.value)}>
                  <Text style={{ color: period === item.value ? palette.primary : palette.text, fontSize: 11, fontWeight: "700" }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            {period === "custom" ? (
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <DateField label="Start date" value={startDate} onChange={setStartDate} />
                </View>
                <View style={{ flex: 1 }}>
                  <DateField label="End date" value={endDate} onChange={setEndDate} />
                </View>
              </View>
            ) : null}

            <Text style={[styles.label, { color: palette.text }]}>Transaction type</Text>
            <View style={styles.chips}>
              {(["both", "income", "expense"] as const).map((value) => (
                <Pressable key={value} onPress={() => setTransactionType(value)} style={chipStyle(transactionType === value)}>
                  <Text style={{ color: transactionType === value ? palette.primary : palette.text, fontSize: 11, fontWeight: "700" }}>
                    {value === "both" ? "Income & expenses" : value === "income" ? "Income only" : "Expenses only"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: palette.text }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
              <Pressable onPress={() => setCategory("all")} style={chipStyle(category === "all")}>
                <Text style={{ color: category === "all" ? palette.primary : palette.text, fontSize: 11, fontWeight: "700" }}>All categories</Text>
              </Pressable>
              {categories.map((value) => (
                <Pressable key={value} onPress={() => setCategory(value)} style={chipStyle(category === value)}>
                  <Text style={{ color: category === value ? palette.primary : palette.text, fontSize: 11, fontWeight: "700" }}>{value}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {dateInvalid ? <Text style={styles.errorText}>Choose a valid date range. The end date must be on or after the start date.</Text> : null}

            <View style={[styles.countCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.fieldCaption, { color: palette.textMuted }]}>MATCHING TRANSACTIONS</Text>
              <Text style={[styles.count, { color: palette.text }]}>{filteredRows.length}</Text>
              <Text style={[styles.fieldCaption, { color: palette.textMuted }]}>Descriptions are included. Transfers are excluded.</Text>
            </View>

            <Pressable disabled={busy || dateInvalid || filteredRows.length === 0} onPress={() => void exportCsv()} style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: busy || dateInvalid || filteredRows.length === 0 ? 0.5 : 1 }]}>
              <MaterialCommunityIcons name="share-outline" size={18} color="#fff" />
              <Text style={styles.primaryText}>{busy ? "Preparing…" : "Share CSV file"}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  headingIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800" },
  description: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  toolRow: { flexDirection: "row", gap: 9, marginTop: 17 },
  primaryButton: { flex: 1, minHeight: 46, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, paddingHorizontal: 12, borderRadius: 12 },
  primaryText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  secondaryButton: { flex: 1, minHeight: 46, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  secondaryText: { fontSize: 12, fontWeight: "800" },
  templateButton: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 11 },
  templateText: { fontSize: 11, fontWeight: "800" },
  message: { borderRadius: 12, padding: 11, marginTop: 12 },
  modal: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  modalTitle: { fontSize: 22, fontWeight: "900" },
  label: { fontSize: 12, fontWeight: "800", marginTop: 18, marginBottom: 9 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 9 },
  dateRow: { flexDirection: "row", gap: 9, marginTop: 15 },
  fieldCaption: { fontSize: 10, lineHeight: 15 },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 11, fontSize: 12, marginTop: 5 },
  categoryChips: { gap: 7, paddingVertical: 2 },
  errorText: { color: "#D32F2F", fontSize: 11, lineHeight: 16, marginTop: 12 },
  countCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 26, gap: 4 },
});