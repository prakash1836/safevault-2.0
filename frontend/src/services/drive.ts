// Google Drive service - supports both real API and demo mode
// In demo mode, "uploads" are stored locally (encrypted) and get a mock fileId.
import * as FileSystem from 'expo-file-system/legacy';
import type { AuthUser, DriveUsage } from '../types';

const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_ABOUT = 'https://www.googleapis.com/drive/v3/about?fields=storageQuota';

const VAULT_DIR = (FileSystem.documentDirectory || '') + 'safevault/';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(VAULT_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
}

export async function saveEncryptedLocal(fileId: string, ciphertext: string): Promise<string> {
  await ensureDir();
  const path = VAULT_DIR + fileId + '.enc';
  await FileSystem.writeAsStringAsync(path, ciphertext);
  return path;
}

export async function readEncryptedLocal(path: string): Promise<string> {
  return await FileSystem.readAsStringAsync(path);
}

export async function deleteEncryptedLocal(path?: string | null) {
  if (!path) return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {}
}

// Real Google Drive upload (used when user.accessToken present and not demo)
export async function uploadToDrive(
  user: AuthUser,
  fileName: string,
  ciphertext: string,
  mimeType = 'application/octet-stream'
): Promise<string> {
  if (user.demo || !user.accessToken) {
    const fakeId = 'demo_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await saveEncryptedLocal(fakeId, ciphertext);
    return fakeId;
  }
  const boundary = 'safevault_' + Date.now();
  const metadata = { name: fileName, mimeType };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n` +
    ciphertext +
    `\r\n--${boundary}--`;
  const res = await fetch(DRIVE_UPLOAD, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error('Drive upload failed: ' + res.status);
  const data = await res.json();
  return data.id;
}

export async function deleteFromDrive(user: AuthUser, fileId: string, localPath?: string | null) {
  if (user.demo || !user.accessToken) {
    await deleteEncryptedLocal(localPath);
    return;
  }
  await fetch(`${DRIVE_FILES}/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  await deleteEncryptedLocal(localPath);
}

export async function fetchDriveQuota(user: AuthUser): Promise<DriveUsage> {
  if (user.demo || !user.accessToken) {
    return { total: 15 * 1024 * 1024 * 1024, used: 1.2 * 1024 * 1024 * 1024, vault: 0 };
  }
  const res = await fetch(DRIVE_ABOUT, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  if (!res.ok) throw new Error('Drive quota fetch failed');
  const data = await res.json();
  const sq = data.storageQuota || {};
  return {
    total: Number(sq.limit || 15 * 1024 * 1024 * 1024),
    used: Number(sq.usage || 0),
    vault: Number(sq.usageInDrive || 0),
  };
}
