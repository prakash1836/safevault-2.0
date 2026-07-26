// Google Drive service - supports both real API and demo mode
// In demo mode, "uploads" are stored locally (encrypted) and get a mock fileId.
import * as FileSystem from 'expo-file-system/legacy';
import type { AuthUser, DriveUsage } from '../types';
import { RESUMABLE_UPLOAD_THRESHOLD_BYTES } from '../constants/upload';

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

export interface UploadOptions {
  /** Called with 0..1 progress. May be called synchronously with 0 and 1 for platforms without progress. */
  onProgress?: (progress: number) => void;
  /** AbortSignal-compatible hook — currently unused; reserved for future resumable-upload cancellation. */
  signal?: AbortSignal;
}

/**
 * POST a multipart Drive upload with progress events using XMLHttpRequest.
 *
 * Kept as a small, well-typed function so the future resumable-upload engine can be
 * introduced side-by-side (see RESUMABLE_UPLOAD_THRESHOLD_BYTES) without changing
 * callers.
 */
function xhrMultipartUpload(
  accessToken: string,
  body: string,
  boundary: string,
  onProgress?: (p: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', DRIVE_UPLOAD, true);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && ev.total > 0) {
          onProgress(Math.min(1, ev.loaded / ev.total));
        }
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          onProgress?.(1);
          resolve(String(data.id || ''));
        } catch (e: any) {
          reject(new Error('Drive upload succeeded but returned an invalid response'));
        }
      } else {
        reject(new Error('Drive upload failed: ' + xhr.status));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during Drive upload'));
    xhr.onabort  = () => reject(new Error('Drive upload aborted'));
    xhr.send(body);
  });
}

/**
 * Upload a (client-side encrypted) payload to Google Drive.
 * In demo/anonymous mode the payload is written locally with a synthetic fileId.
 *
 * `opts.onProgress` receives 0..1 during network transfer.
 * Payloads over RESUMABLE_UPLOAD_THRESHOLD_BYTES should later route through a
 * resumable-upload path — left as a follow-up; behavior is unchanged for now.
 */
export async function uploadToDrive(
  user: AuthUser,
  fileName: string,
  ciphertext: string,
  mimeType = 'application/octet-stream',
  opts: UploadOptions = {}
): Promise<string> {
  const { onProgress } = opts;

  if (user.demo || !user.accessToken) {
    onProgress?.(0);
    const fakeId = 'demo_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await saveEncryptedLocal(fakeId, ciphertext);
    onProgress?.(1);
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

  // Prefer XHR so we get real upload.onprogress events.
  if (typeof XMLHttpRequest !== 'undefined') {
    onProgress?.(0);
    return xhrMultipartUpload(user.accessToken, body, boundary, onProgress);
  }

  // Fallback: plain fetch (no progress reporting).
  onProgress?.(0);
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
  onProgress?.(1);
  // Reserved for future resumable path when body length exceeds threshold.
  void RESUMABLE_UPLOAD_THRESHOLD_BYTES;
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
