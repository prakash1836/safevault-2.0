// MetadataManager — owns `metadata.json`.
//
// Architecture rule: this file is the ONLY place that knows the manifest
// schema, integrity check, and Drive location of `metadata.json`. Higher
// layers (SyncManager) ask for the manifest and hand back a patched one;
// they never marshal the JSON themselves.
//
// Sprint 2 delivers:
//   • Manifest shape (schemaVersion, revision, createdAt, updatedAt, deviceId,
//     appVersion, documents, categories, tombstones)
//   • SHA-256 integrity check on load
//   • Automatic recovery from `metadata.bak` on integrity failure
//   • Encrypted upload/download using the existing PBKDF2 key
//   • Backup rotation on save
//
// The merge/conflict-resolution logic is Sprint 4.

import CryptoJS from 'crypto-js';
import type {
  AuthUser,
  VaultDocument,
  DocCategory,
} from '../types';
import { FolderManager } from './folderManager';
import {
  findFileOnDrive,
  downloadFromDrive,
  uploadToDrive,
  updateFileOnDrive,
  deleteFromDrive,
  type DriveFileRef,
} from './drive';
import {
  encryptJSON,
  decryptJSON,
  decryptToBase64,
  getKey,
} from './encryption';

/* -------------------------------------------------------------------------- */
/* Shape                                                                      */
/* -------------------------------------------------------------------------- */

export const CURRENT_SCHEMA_VERSION = 1;

const MANIFEST_NAME = 'metadata.json';
const MANIFEST_BACKUP_NAME = 'metadata.bak';
const MANIFEST_MIME = 'application/octet-stream';

export interface ManifestDocEntry {
  id: string;
  name: string;
  category: DocCategory;
  ownerId: string;
  driveFolderId: string | null;
  current: {
    version: number;
    fileId: string | null;
    fileHash: string | null;
    size: number | null;
    mimeType: string | null;
    uploadedAt: string;
  };
  history: Array<{
    version: number;
    fileId: string;
    fileHash: string | null;
    size: number | null;
    uploadedAt: string;
  }>;
  issueDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  reminder: { days30: boolean; days7: boolean; days1: boolean };
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  deletedAt: string | null;
}

export interface ManifestCategoryEntry {
  name: DocCategory;
  driveFolderId: string | null;
  createdAt: string;
}

export interface ManifestTombstone {
  docId: string;
  deletedAt: string;
  hardDeleteAfter: string;
}

export interface VaultManifest {
  schemaVersion: number;
  revision: number;
  vaultId: string;
  createdAt: string;
  updatedAt: string;
  deviceId: string;
  appVersion: string;
  documents: ManifestDocEntry[];
  categories: ManifestCategoryEntry[];
  tombstones: ManifestTombstone[];
}

/* -------------------------------------------------------------------------- */
/* Utility                                                                    */
/* -------------------------------------------------------------------------- */

function nowIso(): string { return new Date().toISOString(); }

function sha256OfUtf8(s: string): string {
  return CryptoJS.SHA256(CryptoJS.enc.Utf8.parse(s)).toString(CryptoJS.enc.Hex);
}

/**
 * Compute the canonical SHA-256 of a manifest.
 *
 * We serialise a copy of the manifest that OMITS `updatedAt` (which the caller
 * bumps on every write) so the hash represents the *content* only. Signed body
 * comparisons remain stable across writers that touch nothing but timestamps.
 */
export function computeManifestHash(m: VaultManifest): string {
  const { updatedAt, ...rest } = m;
  return sha256OfUtf8(JSON.stringify(rest));
}

export function buildEmptyManifest(input: {
  deviceId: string;
  appVersion: string;
  vaultId: string;
}): VaultManifest {
  const t = nowIso();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
    vaultId: input.vaultId,
    createdAt: t,
    updatedAt: t,
    deviceId: input.deviceId,
    appVersion: input.appVersion,
    documents: [],
    categories: [],
    tombstones: [],
  };
}

/** Structural validation. Returns an array of problems; empty means valid. */
export function validateManifest(m: any): string[] {
  const errs: string[] = [];
  if (!m || typeof m !== 'object') return ['manifest is not an object'];
  if (typeof m.schemaVersion !== 'number') errs.push('schemaVersion is not a number');
  if (typeof m.revision !== 'number') errs.push('revision is not a number');
  if (typeof m.vaultId !== 'string' || !m.vaultId) errs.push('vaultId is missing');
  if (typeof m.createdAt !== 'string') errs.push('createdAt is missing');
  if (typeof m.updatedAt !== 'string') errs.push('updatedAt is missing');
  if (typeof m.deviceId !== 'string') errs.push('deviceId is missing');
  if (typeof m.appVersion !== 'string') errs.push('appVersion is missing');
  if (!Array.isArray(m.documents)) errs.push('documents is not an array');
  if (!Array.isArray(m.categories)) errs.push('categories is not an array');
  if (!Array.isArray(m.tombstones)) errs.push('tombstones is not an array');
  if (m.schemaVersion > CURRENT_SCHEMA_VERSION) {
    errs.push(`schemaVersion ${m.schemaVersion} is newer than this client (max ${CURRENT_SCHEMA_VERSION})`);
  }
  return errs;
}

/* -------------------------------------------------------------------------- */
/* Domain helpers — pure                                                      */
/* -------------------------------------------------------------------------- */

/** Convert a VaultDocument (Phase-1 shape) into a ManifestDocEntry. */
export function docToManifestEntry(doc: VaultDocument, driveFolderId: string | null): ManifestDocEntry {
  return {
    id: doc.id,
    name: doc.name,
    category: doc.category,
    ownerId: doc.ownerId,
    driveFolderId,
    current: {
      version: 1,
      fileId: doc.fileId,
      fileHash: doc.fileHash ?? null,
      size: doc.size ?? null,
      mimeType: doc.mimeType ?? null,
      uploadedAt: doc.createdAt,
    },
    history: [],
    issueDate: doc.issueDate ?? null,
    expiryDate: doc.expiryDate ?? null,
    notes: doc.notes ?? null,
    reminder: doc.reminder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deleted: false,
    deletedAt: null,
  };
}

export function applyDocUpsert(m: VaultManifest, entry: ManifestDocEntry): VaultManifest {
  const documents = [...m.documents];
  const idx = documents.findIndex((d) => d.id === entry.id);
  if (idx >= 0) documents[idx] = entry; else documents.push(entry);
  return { ...m, documents, updatedAt: nowIso() };
}

export function applyDocSoftDelete(m: VaultManifest, docId: string, hardDeleteAfterHours = 24): VaultManifest {
  const at = nowIso();
  const hardDeleteAfter = new Date(Date.now() + hardDeleteAfterHours * 3600 * 1000).toISOString();
  const documents = m.documents.map((d) =>
    d.id === docId ? { ...d, deleted: true, deletedAt: at, updatedAt: at } : d
  );
  const tombstones = [
    ...m.tombstones.filter((t) => t.docId !== docId),
    { docId, deletedAt: at, hardDeleteAfter },
  ];
  return { ...m, documents, tombstones, updatedAt: at };
}

/* -------------------------------------------------------------------------- */
/* Drive I/O                                                                  */
/* -------------------------------------------------------------------------- */

async function findManifestFile(user: AuthUser, name: string): Promise<DriveFileRef | null> {
  const manifestFolderId = await FolderManager.ensureSubfolder(user, 'manifest');
  return findFileOnDrive(user, {
    name,
    parentId: manifestFolderId,
    onlyFolders: false,
    appProperties: { 'safevault': '1', 'safevault.role': 'manifest' },
  });
}

/**
 * Decrypt & verify a downloaded manifest payload.
 * Throws when either decryption or integrity verification fails.
 */
function decryptAndVerifyManifest(cipherPayload: string, keyHex: string, expectedHash: string | null): VaultManifest {
  const manifest = decryptJSON<VaultManifest>(cipherPayload, keyHex);
  const errs = validateManifest(manifest);
  if (errs.length) {
    throw new Error('Manifest failed validation: ' + errs.join('; '));
  }
  const actual = computeManifestHash(manifest);
  if (expectedHash && expectedHash !== actual) {
    throw new Error(`Manifest hash mismatch (expected ${expectedHash.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`);
  }
  return manifest;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export interface LoadResult {
  manifest: VaultManifest;
  /** true if the primary metadata.json was corrupted and we recovered from metadata.bak. */
  recovered: boolean;
  /** true if no manifest existed on Drive yet — caller should create one. */
  isEmpty: boolean;
  /** Drive fileId of the manifest we returned (or null when empty). */
  fileId: string | null;
}

export const MetadataManager = {
  CURRENT_SCHEMA_VERSION,

  buildEmptyManifest,
  computeManifestHash,
  validateManifest,
  docToManifestEntry,
  applyDocUpsert,
  applyDocSoftDelete,

  /**
   * Load the manifest from Drive.
   *   1. Try primary metadata.json → decrypt → verify SHA-256.
   *   2. On any failure, fall back to metadata.bak.
   *   3. If both fail, throw a distinctive `ManifestCorruptedError` so
   *      SyncManager can decide how to inform the user.
   *   4. If neither file exists, return an empty manifest with isEmpty=true.
   */
  async load(user: AuthUser, deviceId: string, appVersion: string): Promise<LoadResult> {
    const key = await getKey();
    if (!key) throw new Error('Encryption key not available');

    const [primary, backup] = await Promise.all([
      findManifestFile(user, MANIFEST_NAME),
      findManifestFile(user, MANIFEST_BACKUP_NAME),
    ]);

    if (!primary && !backup) {
      const vaultId = 'sv_' + (user.id || 'anon');
      return {
        manifest: buildEmptyManifest({ deviceId, appVersion, vaultId }),
        recovered: false,
        isEmpty: true,
        fileId: null,
      };
    }

    // Attempt primary
    if (primary) {
      try {
        const payload = await downloadFromDrive(user, primary.id);
        const expected = primary.appProperties?.['safevault.hash'] ?? null;
        const manifest = decryptAndVerifyManifest(payload, key, expected);
        return { manifest, recovered: false, isEmpty: false, fileId: primary.id };
      } catch (primaryErr) {
        // Fall through to backup
        // eslint-disable-next-line no-console
        console.warn('[metadata] primary manifest failed:', (primaryErr as Error)?.message);
      }
    }

    // Attempt backup
    if (backup) {
      try {
        const payload = await downloadFromDrive(user, backup.id);
        const expected = backup.appProperties?.['safevault.hash'] ?? null;
        const manifest = decryptAndVerifyManifest(payload, key, expected);
        return { manifest, recovered: true, isEmpty: false, fileId: backup.id };
      } catch (backupErr) {
        const e = new Error('Manifest is corrupted and backup recovery failed');
        (e as any).code = 'ManifestCorruptedError';
        throw e;
      }
    }

    // Only primary existed and failed
    const e = new Error('Manifest is corrupted and no backup was found');
    (e as any).code = 'ManifestCorruptedError';
    throw e;
  },

  /**
   * Persist a manifest to Drive.
   *
   *   1. Bump `revision` and `updatedAt`.
   *   2. Compute SHA-256; stamp into appProperties.
   *   3. If a manifest already exists → rotate the previous body into
   *      metadata.bak (create or overwrite) before we upload the new primary.
   *   4. Encrypt with the user's PBKDF2 key.
   *   5. Upload as `metadata.json` under the manifest folder.
   */
  async save(user: AuthUser, manifest: VaultManifest): Promise<{ fileId: string; hash: string; manifest: VaultManifest }> {
    const key = await getKey();
    if (!key) throw new Error('Encryption key not available');

    const manifestFolderId = await FolderManager.ensureSubfolder(user, 'manifest');

    // 1. Prepare new manifest
    const next: VaultManifest = {
      ...manifest,
      revision: (manifest.revision || 0) + 1,
      updatedAt: nowIso(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
    const hash = computeManifestHash(next);

    const errs = validateManifest(next);
    if (errs.length) throw new Error('Refusing to save invalid manifest: ' + errs.join('; '));

    const cipher = encryptJSON(next, key);

    // 2. Rotate: if primary exists, copy its ciphertext into .bak first.
    const existingPrimary = await findManifestFile(user, MANIFEST_NAME);
    if (existingPrimary) {
      try {
        const prevCipher = await downloadFromDrive(user, existingPrimary.id);
        const prevHash = existingPrimary.appProperties?.['safevault.hash'] || '';
        const existingBackup = await findManifestFile(user, MANIFEST_BACKUP_NAME);
        const bakTags = {
          'safevault': '1',
          'safevault.role': 'manifest',
          'safevault.backupOf': MANIFEST_NAME,
          'safevault.hash': prevHash,
        };
        if (existingBackup) {
          await updateFileOnDrive(user, existingBackup.id, {
            body: prevCipher,
            mimeType: MANIFEST_MIME,
            appProperties: bakTags,
          });
        } else {
          await uploadToDrive(user, MANIFEST_BACKUP_NAME, prevCipher, MANIFEST_MIME, {
            parentId: manifestFolderId,
            appProperties: bakTags,
          });
        }
      } catch (rotErr) {
        // Backup rotation is best-effort; log but continue.
        // eslint-disable-next-line no-console
        console.warn('[metadata] backup rotation failed:', (rotErr as Error)?.message);
      }
    }

    // 3. Upload new primary — either replace existing or create.
    const tags = {
      'safevault': '1',
      'safevault.role': 'manifest',
      'safevault.hash': hash,
      'safevault.revision': String(next.revision),
      'safevault.deviceId': next.deviceId,
      'safevault.appVersion': next.appVersion,
      'safevault.updatedAt': next.updatedAt,
    };

    let fileId: string;
    if (existingPrimary) {
      const updated = await updateFileOnDrive(user, existingPrimary.id, {
        body: cipher,
        mimeType: MANIFEST_MIME,
        appProperties: tags,
      });
      fileId = updated.id;
    } else {
      fileId = await uploadToDrive(user, MANIFEST_NAME, cipher, MANIFEST_MIME, {
        parentId: manifestFolderId,
        appProperties: tags,
      });
    }

    return { fileId, hash, manifest: next };
  },

  /**
   * Manually delete the manifest + backup. Used only by tests / factory reset.
   */
  async wipe(user: AuthUser): Promise<void> {
    const [primary, backup] = await Promise.all([
      findManifestFile(user, MANIFEST_NAME),
      findManifestFile(user, MANIFEST_BACKUP_NAME),
    ]);
    if (primary) await deleteFromDrive(user, primary.id);
    if (backup)  await deleteFromDrive(user, backup.id);
  },
};

/* -------------------------------------------------------------------------- */
/* Test-only helpers (safe to leave exported — used by unit / integration)    */
/* -------------------------------------------------------------------------- */

/**
 * Decrypt + verify a manifest payload without touching Drive. Handy for
 * corruption / recovery tests that fabricate ciphertext.
 */
export function decryptAndVerifyForTest(payload: string, keyHex: string, expectedHash: string | null): VaultManifest {
  return decryptAndVerifyManifest(payload, keyHex, expectedHash);
}

/**
 * Best-effort plain read — returns the parsed manifest but does NOT throw
 * on hash mismatch (mismatch is reported by the caller). Used by recovery
 * flows and diagnostics.
 */
export function decryptWithoutHashCheck(payload: string, keyHex: string): VaultManifest {
  try {
    return decryptJSON<VaultManifest>(payload, keyHex);
  } catch (e) {
    // If it's actually a plaintext JSON (test fixture), tolerate it.
    try {
      const asB64 = decryptToBase64(payload, keyHex);
      const raw = CryptoJS.enc.Base64.parse(asB64).toString(CryptoJS.enc.Utf8);
      return JSON.parse(raw) as VaultManifest;
    } catch {
      throw e;
    }
  }
}
