// Google Drive service — low-level, stateless Drive communication.
// Sprint 1 of Phase 2. Extends Phase 1 exports; existing callers are unaffected.
//
// Architecture rule: this file MUST only communicate with Google Drive. It never
// touches manifest logic, folder caching, or sync state. Higher layers
// (FolderManager, MetadataManager, SyncManager) compose these primitives.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { AuthUser, DriveUsage } from '../types';
import { RESUMABLE_UPLOAD_THRESHOLD_BYTES } from '../constants/upload';

const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DRIVE_RESUMABLE_INIT = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_ABOUT = 'https://www.googleapis.com/drive/v3/about?fields=storageQuota';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

const VAULT_DIR = (FileSystem.documentDirectory || '') + 'safevault/';
const IS_WEB = Platform.OS === 'web';

/* -------------------------------------------------------------------------- */
/* Local encrypted cache (file system)                                        */
/* -------------------------------------------------------------------------- */

async function ensureDir(): Promise<boolean> {
  if (IS_WEB) return false; // No file-system on web; caller must gracefully skip.
  const info = await FileSystem.getInfoAsync(VAULT_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
  return true;
}

/**
 * Save ciphertext to the encrypted local cache. Returns the local path, or `null`
 * on platforms without a real file system (web). Callers should treat a `null`
 * result as "no local cache available on this platform" and proceed.
 */
export async function saveEncryptedLocal(fileId: string, ciphertext: string): Promise<string | null> {
  if (!(await ensureDir())) return null;
  const path = VAULT_DIR + fileId + '.enc';
  await FileSystem.writeAsStringAsync(path, ciphertext);
  return path;
}

export async function readEncryptedLocal(path: string): Promise<string | null> {
  if (IS_WEB) return null;
  try {
    return await FileSystem.readAsStringAsync(path);
  } catch {
    return null;
  }
}

export async function deleteEncryptedLocal(path?: string | null) {
  if (!path || IS_WEB) return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {}
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface UploadOptions {
  /** Called with 0..1 progress. May be called synchronously with 0 and 1 for platforms without progress. */
  onProgress?: (progress: number) => void;
  /** AbortSignal-compatible hook — currently unused; reserved for future resumable-upload cancellation. */
  signal?: AbortSignal;
  /** Parent Drive folder ID. If omitted, the file lands in root of My Drive. */
  parentId?: string;
  /** Drive `appProperties` — small key/value tags (invisible outside our scope). */
  appProperties?: Record<string, string>;
}

export interface DownloadOptions {
  /** Called with 0..1 progress. */
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

export interface DriveFileRef {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  size?: string;
  modifiedTime?: string;
}

export interface FindQuery {
  /** Match by exact name (escaped). */
  name?: string;
  /** Match files whose parent contains this ID. */
  parentId?: string;
  /** Only folders / only non-folders. Omit for either. */
  onlyFolders?: boolean;
  /** appProperties equality filters — every key must match. */
  appProperties?: Record<string, string>;
  /** Include trashed files. Defaults to false. */
  includeTrashed?: boolean;
  /** Extra fields to request beyond the defaults. */
  fields?: string;
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

function assertOnline(user: AuthUser): asserts user is AuthUser & { accessToken: string } {
  if (user.demo || !user.accessToken) {
    throw new Error('Drive API unavailable in the current session');
  }
}

function authHeaders(user: AuthUser & { accessToken: string }): HeadersInit {
  return { Authorization: `Bearer ${user.accessToken}` };
}

/** Escape single quotes for use inside a Drive v3 `q=` string. */
function esc(v: string): string { return v.replace(/'/g, "\\'"); }

async function driveJson<T>(res: Response, ctx: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${ctx} failed: ${res.status}${text ? ' — ' + text.slice(0, 240) : ''}`);
  }
  return res.json() as Promise<T>;
}

/* -------------------------------------------------------------------------- */
/* Upload — multipart                                                         */
/* -------------------------------------------------------------------------- */

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
        } catch {
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
 * `opts.parentId` places the file inside a specific folder (used by FolderManager).
 * `opts.appProperties` attaches Drive metadata tags (invisible outside our scope).
 * `opts.onProgress` receives 0..1 during network transfer.
 *
 * Payloads over RESUMABLE_UPLOAD_THRESHOLD_BYTES automatically take the resumable
 * upload path (see resumableUpload).
 */
export async function uploadToDrive(
  user: AuthUser,
  fileName: string,
  ciphertext: string,
  mimeType = 'application/octet-stream',
  opts: UploadOptions = {}
): Promise<string> {
  const { onProgress, parentId, appProperties } = opts;

  if (user.demo || !user.accessToken) {
    onProgress?.(0);
    const fakeId = 'demo_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await saveEncryptedLocal(fakeId, ciphertext);
    onProgress?.(1);
    return fakeId;
  }

  // Route large payloads to the resumable engine.
  if (ciphertext.length >= RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
    return resumableUpload(user, fileName, ciphertext, mimeType, opts);
  }

  const boundary = 'safevault_' + Date.now();
  const metadata: Record<string, any> = { name: fileName, mimeType };
  if (parentId) metadata.parents = [parentId];
  if (appProperties && Object.keys(appProperties).length) metadata.appProperties = appProperties;

  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n` +
    ciphertext +
    `\r\n--${boundary}--`;

  if (typeof XMLHttpRequest !== 'undefined') {
    onProgress?.(0);
    return xhrMultipartUpload(user.accessToken, body, boundary, onProgress);
  }

  onProgress?.(0);
  const res = await fetch(DRIVE_UPLOAD, {
    method: 'POST',
    headers: {
      ...authHeaders(user as any),
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const data = await driveJson<any>(res, 'Drive upload');
  onProgress?.(1);
  return data.id;
}

/* -------------------------------------------------------------------------- */
/* Upload — resumable (for payloads > RESUMABLE_UPLOAD_THRESHOLD_BYTES)       */
/* -------------------------------------------------------------------------- */

/**
 * Resumable Drive upload.
 *
 * Session lifecycle:
 *   1. POST metadata to /upload/drive/v3/files?uploadType=resumable → session URL in `Location` header.
 *   2. PUT the body to the session URL. The Drive server returns 200/201 on success.
 *
 * This implementation currently sends the body in a single PUT. Chunk-by-chunk
 * range uploads (with Content-Range) are a follow-up: the session URL returned
 * by step 1 can be reused for retries, so this shape is forward-compatible with
 * true chunked resume without breaking callers.
 */
export async function resumableUpload(
  user: AuthUser,
  fileName: string,
  ciphertext: string,
  mimeType = 'application/octet-stream',
  opts: UploadOptions = {}
): Promise<string> {
  assertOnline(user);
  const { onProgress, parentId, appProperties } = opts;

  const metadata: Record<string, any> = { name: fileName, mimeType };
  if (parentId) metadata.parents = [parentId];
  if (appProperties && Object.keys(appProperties).length) metadata.appProperties = appProperties;

  onProgress?.(0);

  // Step 1 — initiate session
  const initRes = await fetch(DRIVE_RESUMABLE_INIT, {
    method: 'POST',
    headers: {
      ...authHeaders(user),
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
    },
    body: JSON.stringify(metadata),
  });
  if (!initRes.ok) {
    const text = await initRes.text().catch(() => '');
    throw new Error(`Resumable init failed: ${initRes.status}${text ? ' — ' + text.slice(0, 240) : ''}`);
  }
  const sessionUrl = initRes.headers.get('Location');
  if (!sessionUrl) throw new Error('Resumable init returned no session URL');

  // Step 2 — PUT body via XHR for progress
  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', sessionUrl, true);
      xhr.setRequestHeader('Content-Type', mimeType);
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
          } catch {
            reject(new Error('Resumable upload succeeded but returned invalid response'));
          }
        } else {
          reject(new Error('Resumable upload failed: ' + xhr.status));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during resumable upload'));
      xhr.onabort  = () => reject(new Error('Resumable upload aborted'));
      xhr.send(ciphertext);
    });
  }

  // Non-XHR fallback (no progress)
  const putRes = await fetch(sessionUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: ciphertext,
  });
  const data = await driveJson<any>(putRes, 'Resumable upload');
  onProgress?.(1);
  return data.id;
}

/* -------------------------------------------------------------------------- */
/* Download                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Download a file's contents (ciphertext) from Drive.
 * Returns the response body as a string — callers decrypt via services/encryption.
 */
export async function downloadFromDrive(
  user: AuthUser,
  fileId: string,
  opts: DownloadOptions = {}
): Promise<string> {
  assertOnline(user);
  const { onProgress } = opts;

  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `${DRIVE_FILES}/${fileId}?alt=media`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${user.accessToken as string}`);
      xhr.onprogress = (ev) => {
        if (ev.lengthComputable && ev.total > 0 && onProgress) {
          onProgress(Math.min(1, ev.loaded / ev.total));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(1);
          resolve(xhr.responseText || '');
        } else {
          reject(new Error('Drive download failed: ' + xhr.status));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during Drive download'));
      xhr.onabort  = () => reject(new Error('Drive download aborted'));
      xhr.send();
    });
  }

  onProgress?.(0);
  const res = await fetch(`${DRIVE_FILES}/${fileId}?alt=media`, {
    headers: authHeaders(user),
  });
  if (!res.ok) throw new Error('Drive download failed: ' + res.status);
  const text = await res.text();
  onProgress?.(1);
  return text;
}

/* -------------------------------------------------------------------------- */
/* Folder & metadata operations                                               */
/* -------------------------------------------------------------------------- */

/** Create a folder on Drive. Returns the folder's `fileId`. */
export async function createFolderOnDrive(
  user: AuthUser,
  name: string,
  parentId?: string,
  appProperties?: Record<string, string>
): Promise<string> {
  assertOnline(user);
  const body: Record<string, any> = { name, mimeType: FOLDER_MIME };
  if (parentId) body.parents = [parentId];
  if (appProperties && Object.keys(appProperties).length) body.appProperties = appProperties;

  const res = await fetch(`${DRIVE_FILES}?fields=id,name,parents,appProperties`, {
    method: 'POST',
    headers: { ...authHeaders(user), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await driveJson<{ id: string }>(res, 'Create folder');
  return data.id;
}

/**
 * Search for the first file matching the query. Returns `null` when nothing matches.
 * Only files created by SafeVault (drive.file scope) are ever returned.
 */
export async function findFileOnDrive(
  user: AuthUser,
  q: FindQuery
): Promise<DriveFileRef | null> {
  assertOnline(user);
  const clauses: string[] = ['trashed = ' + (q.includeTrashed ? 'true' : 'false')];
  if (q.name)      clauses.push(`name = '${esc(q.name)}'`);
  if (q.parentId)  clauses.push(`'${esc(q.parentId)}' in parents`);
  if (q.onlyFolders === true) clauses.push(`mimeType = '${FOLDER_MIME}'`);
  if (q.onlyFolders === false) clauses.push(`mimeType != '${FOLDER_MIME}'`);
  if (q.appProperties) {
    for (const [k, v] of Object.entries(q.appProperties)) {
      clauses.push(`appProperties has { key='${esc(k)}' and value='${esc(v)}' }`);
    }
  }
  const query = encodeURIComponent(clauses.join(' and '));
  const fields = q.fields || 'files(id,name,mimeType,parents,appProperties,size,modifiedTime)';
  const url = `${DRIVE_FILES}?q=${query}&fields=${encodeURIComponent(fields)}&pageSize=1&spaces=drive`;
  const res = await fetch(url, { headers: authHeaders(user) });
  const data = await driveJson<{ files?: DriveFileRef[] }>(res, 'Drive find');
  const first = data.files && data.files[0];
  return first || null;
}

export interface UpdateFilePatch {
  /** New name (metadata-only rename). */
  name?: string;
  /** Add these appProperties (merged with existing). Set a value to `null` to delete a key. */
  appProperties?: Record<string, string | null>;
  /** New parents. Passed as `addParents` / `removeParents` if `oldParentId` provided. */
  parents?: string[];
  /** For a media replace, pass a new body + mimeType. */
  body?: string;
  mimeType?: string;
  /** If replacing media and moving parents at the same time, provide the previous parent. */
  oldParentId?: string;
}

/**
 * Update a file's metadata, and optionally its media body.
 *
 * - Metadata-only patch → PATCH .../files/{id}
 * - Media replace       → PATCH .../upload/drive/v3/files/{id}?uploadType=multipart
 */
export async function updateFileOnDrive(
  user: AuthUser,
  fileId: string,
  patch: UpdateFilePatch,
  opts: UploadOptions = {}
): Promise<DriveFileRef> {
  assertOnline(user);

  const metadata: Record<string, any> = {};
  if (patch.name !== undefined) metadata.name = patch.name;
  if (patch.appProperties) metadata.appProperties = patch.appProperties;

  // Metadata-only
  if (patch.body === undefined) {
    const url = new URL(`${DRIVE_FILES}/${fileId}`);
    url.searchParams.set('fields', 'id,name,mimeType,parents,appProperties,modifiedTime');
    if (patch.parents && patch.oldParentId) {
      url.searchParams.set('addParents', patch.parents.filter(p => p !== patch.oldParentId).join(','));
      url.searchParams.set('removeParents', patch.oldParentId);
    }
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: { ...authHeaders(user), 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
    return await driveJson<DriveFileRef>(res, 'Update file');
  }

  // Media replace (multipart)
  const boundary = 'safevault_upd_' + Date.now();
  const mime = patch.mimeType || 'application/octet-stream';
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n` +
    patch.body +
    `\r\n--${boundary}--`;

  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,mimeType,parents,appProperties,modifiedTime`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...authHeaders(user), 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  opts.onProgress?.(1);
  return await driveJson<DriveFileRef>(res, 'Update file (media)');
}

/* -------------------------------------------------------------------------- */
/* Delete & quota (existing behaviour, native-guarded)                        */
/* -------------------------------------------------------------------------- */

export async function deleteFromDrive(user: AuthUser, fileId: string, localPath?: string | null) {
  if (user.demo || !user.accessToken) {
    await deleteEncryptedLocal(localPath);
    return;
  }
  await fetch(`${DRIVE_FILES}/${fileId}`, {
    method: 'DELETE',
    headers: authHeaders(user as any),
  });
  await deleteEncryptedLocal(localPath);
}

export async function fetchDriveQuota(user: AuthUser): Promise<DriveUsage> {
  if (user.demo || !user.accessToken) {
    return { total: 15 * 1024 * 1024 * 1024, used: 1.2 * 1024 * 1024 * 1024, vault: 0 };
  }
  const res = await fetch(DRIVE_ABOUT, { headers: authHeaders(user as any) });
  if (!res.ok) throw new Error('Drive quota fetch failed');
  const data = await res.json();
  const sq = data.storageQuota || {};
  return {
    total: Number(sq.limit || 15 * 1024 * 1024 * 1024),
    used: Number(sq.usage || 0),
    vault: Number(sq.usageInDrive || 0),
  };
}
