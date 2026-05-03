// Google Drive API wrapper.
// - Uploads ZIP files with appProperties marker so we can filter them later.
// - Lists files via q=appProperties has {key='safevault' and value='v1'}.
// - Downloads file content as Blob.
// No dependency on vault_index.json; works purely by querying Drive.

import {
  APP_MARKER_KEY,
  APP_MARKER_VALUE,
  DRIVE_API_BASE,
  DRIVE_UPLOAD_BASE,
} from '../utils/constants';
import type { DriveFile } from '../types';

async function authedFetch(
  accessToken: string,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(input, { ...init, headers });
  return res;
}

async function parseError(res: Response): Promise<never> {
  let msg = `Drive API error ${res.status}`;
  try {
    const body = await res.json();
    msg = body?.error?.message || msg;
  } catch {
    // ignore
  }
  throw new Error(msg);
}

export const driveService = {
  /**
   * Upload a ZIP to Drive root (user's My Drive) with our app marker.
   * Uses multipart upload so metadata + content go in one request.
   */
  async uploadZip(params: {
    accessToken: string;
    filename: string; // should end in .zip
    blob: Blob;
    originalName?: string;
    originalMimeType?: string;
  }): Promise<DriveFile> {
    const { accessToken, filename, blob, originalName, originalMimeType } = params;
    const metadata = {
      name: filename,
      mimeType: 'application/zip',
      appProperties: {
        [APP_MARKER_KEY]: APP_MARKER_VALUE,
        originalName: originalName ?? filename.replace(/\.zip$/i, ''),
        originalMimeType: originalMimeType ?? '',
      },
    };

    const boundary = `------safevault${Math.random().toString(16).slice(2)}`;
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const metaPart =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata);
    const filePartHeader =
      delimiter + 'Content-Type: application/zip\r\n\r\n';

    // Assemble multipart body as a Blob
    const body = new Blob([
      metaPart,
      filePartHeader,
      blob,
      closeDelim,
    ], { type: `multipart/related; boundary=${boundary}` });

    const url = `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,appProperties`;
    const res = await authedFetch(accessToken, url, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) await parseError(res);
    return (await res.json()) as DriveFile;
  },

  /** List all ZIP files created by this app (uses appProperties marker). */
  async listAppFiles(accessToken: string): Promise<DriveFile[]> {
    const q = [
      `appProperties has { key='${APP_MARKER_KEY}' and value='${APP_MARKER_VALUE}' }`,
      `trashed = false`,
    ].join(' and ');

    const url = new URL(`${DRIVE_API_BASE}/files`);
    url.searchParams.set('q', q);
    url.searchParams.set('fields', 'files(id,name,mimeType,size,modifiedTime,appProperties)');
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('orderBy', 'modifiedTime desc');
    url.searchParams.set('spaces', 'drive');

    const res = await authedFetch(accessToken, url.toString());
    if (!res.ok) await parseError(res);
    const body = (await res.json()) as { files: DriveFile[] };
    return body.files ?? [];
  },

  /** Fallback listing when appProperties filter fails / user had older files. */
  async listAllZips(accessToken: string): Promise<DriveFile[]> {
    const q = [
      `mimeType = 'application/zip'`,
      `trashed = false`,
    ].join(' and ');
    const url = new URL(`${DRIVE_API_BASE}/files`);
    url.searchParams.set('q', q);
    url.searchParams.set('fields', 'files(id,name,mimeType,size,modifiedTime,appProperties)');
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set('orderBy', 'modifiedTime desc');
    const res = await authedFetch(accessToken, url.toString());
    if (!res.ok) await parseError(res);
    const body = (await res.json()) as { files: DriveFile[] };
    return body.files ?? [];
  },

  /** Download a file's binary content. */
  async downloadFile(accessToken: string, fileId: string): Promise<Blob> {
    const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
    const res = await authedFetch(accessToken, url);
    if (!res.ok) await parseError(res);
    return res.blob();
  },

  async deleteFile(accessToken: string, fileId: string): Promise<void> {
    const url = `${DRIVE_API_BASE}/files/${fileId}`;
    const res = await authedFetch(accessToken, url, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) await parseError(res);
  },
};
