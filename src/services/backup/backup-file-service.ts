import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { createBackupFilename } from "./backup-format";

export async function writeBackupFile(json: string, exportedAt: string): Promise<string> {
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error("The device cache directory is unavailable.");

  const uri = directory + createBackupFilename(exportedAt);
  await FileSystem.writeAsStringAsync(uri, json);
  return uri;
}

export async function shareBackupFile(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("File sharing is not available on this device.");
  }

  await Sharing.shareAsync(uri, {
    dialogTitle: "Export BudgetNest backup",
    mimeType: "application/json",
  });
}

export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) throw new Error("No backup file was selected.");

  return FileSystem.readAsStringAsync(asset.uri);
}
