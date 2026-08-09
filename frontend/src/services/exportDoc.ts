// Export helpers — Original (decrypted) and Encrypted (raw ciphertext).
//
// Reuses the existing DocumentContent / drive / encryption modules — no
// architecture rewrite. Both variants save into the app's cache dir and
// invoke the native share sheet so the user can hand the file to any app.

import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { AuthUser, VaultDocument } from '../types';
import { getDocumentContent } from './documentContent';
import { readEncryptedLocal, downloadFromDrive } from './drive';

/** Very small mime-to-extension map — falls back to `.bin`. */
function extFor(mime?: string | null): string {
  if (!mime) return 'bin';
  const m = mime.toLowerCase();
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('png')) return 'png';
  if (m.includes('jpeg')) return 'jpg';
  if (m.includes('jpg')) return 'jpg';
  if (m.includes('heic')) return 'heic';
  if (m.includes('webp')) return 'webp';
  if (m.includes('plain')) return 'txt';
  if (m.includes('word')) return 'docx';
  if (m.includes('spreadsheet') || m.includes('excel')) return 'xlsx';
  if (m.includes('presentation') || m.includes('powerpoint')) return 'pptx';
  return 'bin';
}

function safeStem(name: string): string {
  return (name || 'document').replace(/[^a-z0-9._-]/gi, '_').slice(0, 80);
}

export interface ExportOptions {
  /** Called with 0..1 for the download portion (may not fire if the file is cache-hit). */
  onProgress?: (p: number) => void;
  /** Called with a coarse-grained stage label — "downloading" | "decrypting" | "writing" | "sharing" | "done" | "error". */
  onStage?: (stage: ExportStage) => void;
}

export type ExportStage =
  | 'preparing'
  | 'downloading'
  | 'decrypting'
  | 'writing'
  | 'sharing'
  | 'done'
  | 'error';

export interface ExportResult {
  /** Local file path (`file://…`) that was shared. */
  path: string;
  /** Which shape of file we exported. */
  kind: 'original' | 'encrypted';
  /** Integrity warning, if the SHA-256 checksum did not match. */
  integrityWarning?: string;
}

/**
 * Export the DECRYPTED original bytes. Reuses `getDocumentContent`, which is
 * cache-first and integrity-verified.
 */
export async function exportOriginal(
  user: AuthUser,
  doc: VaultDocument,
  opts: ExportOptions = {}
): Promise<ExportResult> {
  const { onProgress, onStage } = opts;
  onStage?.('preparing');

  if (Platform.OS === 'web') {
    throw new Error('Export is only supported on mobile');
  }
  if (!doc.localUri && !doc.fileId) {
    throw new Error('This document has no attached file');
  }

  onStage?.(doc.localUri ? 'decrypting' : 'downloading');
  const content = await getDocumentContent(user, doc, { onProgress });

  onStage?.('writing');
  const ext = extFor(doc.mimeType);
  const outPath = (FileSystem.documentDirectory || '') + `${safeStem(doc.name)}.${ext}`;
  await FileSystem.writeAsStringAsync(outPath, content.base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  onStage?.('sharing');
  try {
    await Share.share({ url: outPath, message: doc.name });
  } catch {
    /* user cancelled share sheet — not an error */
  }
  onStage?.('done');
  return { path: outPath, kind: 'original', integrityWarning: content.integrityWarning };
}

/**
 * Export the RAW ciphertext (.enc). Never touches the encryption key — this
 * is safe to hand to any app; only SafeVault can decrypt it. Preferred source
 * is the local encrypted cache; falls back to a fresh Drive download.
 */
export async function exportEncrypted(
  user: AuthUser,
  doc: VaultDocument,
  opts: ExportOptions = {}
): Promise<ExportResult> {
  const { onProgress, onStage } = opts;
  onStage?.('preparing');

  if (Platform.OS === 'web') {
    throw new Error('Export is only supported on mobile');
  }
  if (!doc.localUri && !doc.fileId) {
    throw new Error('This document has no attached file');
  }

  let cipher: string | null = null;
  if (doc.localUri) {
    cipher = await readEncryptedLocal(doc.localUri);
  }
  if (!cipher) {
    if (!doc.fileId) throw new Error('No file to export');
    onStage?.('downloading');
    cipher = await downloadFromDrive(user, doc.fileId, { onProgress });
  }

  onStage?.('writing');
  const outPath = (FileSystem.documentDirectory || '') + `${safeStem(doc.name)}.safevault.enc`;
  await FileSystem.writeAsStringAsync(outPath, cipher);

  onStage?.('sharing');
  try {
    await Share.share({
      url: outPath,
      message: `${doc.name} — encrypted SafeVault backup (can only be opened in SafeVault)`,
    });
  } catch {
    /* cancelled */
  }
  onStage?.('done');
  return { path: outPath, kind: 'encrypted' };
}

export const ExportDoc = { exportOriginal, exportEncrypted };
