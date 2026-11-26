import { getDriveAccessToken } from "./google-auth";

const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files";
const BACKUP_FILENAME = "budgetnest-backup.json";
const BACKUP_MIME_TYPE = "application/json";

type DriveFile = {
  id: string;
  name: string;
  modifiedTime?: string;
};

type DriveListResponse = {
  files?: DriveFile[];
};

async function driveRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = await getDriveAccessToken();

  let response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    const freshToken = await getDriveAccessToken();
    response = await fetch(input, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${freshToken}`,
      },
    });
  }

  return response;
}

async function findExistingBackup(): Promise<DriveFile | null> {
  const query = encodeURIComponent(
    `name = '${BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed = false`,
  );

  const response = await driveRequest(
    `${DRIVE_FILES_ENDPOINT}?spaces=appDataFolder&q=${query}&pageSize=10&fields=files(id,name,modifiedTime)`,
  );

  if (!response.ok) {
    throw new Error(`Unable to find the Google Drive backup (${response.status}).`);
  }

  const payload = (await response.json()) as DriveListResponse;
  return payload.files?.[0] ?? null;
}

function createMultipartBody(
  metadata: Record<string, unknown>,
  json: string,
  boundary: string,
): string {
  return [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${BACKUP_MIME_TYPE}`,
    "",
    json,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export async function uploadBackupToGoogleDrive(json: string): Promise<void> {
  const existing = await findExistingBackup();
  const boundary = `budgetnest-${Date.now()}`;
  const body = createMultipartBody(
    {
      name: BACKUP_FILENAME,
      mimeType: BACKUP_MIME_TYPE,
      ...(existing ? {} : { parents: ["appDataFolder"] }),
    },
    json,
    boundary,
  );

  const endpoint = existing
    ? `${DRIVE_UPLOAD_ENDPOINT}/${existing.id}?uploadType=multipart&fields=id,name,modifiedTime`
    : `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,name,modifiedTime`;

  const response = await driveRequest(endpoint, {
    method: existing ? "PATCH" : "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Unable to save the backup to Google Drive (${response.status}).`);
  }
}

export async function downloadLatestBackupFromGoogleDrive(): Promise<string | null> {
  const existing = await findExistingBackup();
  if (!existing) return null;

  const response = await driveRequest(
    `${DRIVE_FILES_ENDPOINT}/${existing.id}?alt=media`,
  );

  if (!response.ok) {
    throw new Error(`Unable to download the Google Drive backup (${response.status}).`);
  }

  return response.text();
}

export function getGoogleDriveBackupFilename(): string {
  return BACKUP_FILENAME;
}
