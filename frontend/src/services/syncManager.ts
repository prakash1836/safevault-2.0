/**
 * SafeVault sync foundation.
 *
 * This service is deliberately conservative:
 * - A manifest load/corruption/network error is surfaced; it never resets the vault.
 * - Local documents absent from Drive are preserved (including pending/local-only items).
 * - Remote metadata is merged without downloading document bytes; content stays encrypted
 *   and is loaded lazily by the document-content layer.
 * - Deletion is represented by a manifest tombstone; physical cleanup is a separate task.
 */
import type { AuthUser, VaultDocument } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from './storage';
import { FolderManager } from './folderManager';
import {
  MetadataManager,
  type ManifestDocEntry,
  type VaultManifest,
} from './metadataManager';

const APP_VERSION = '2.0.0';
const DEVICE_ID_KEY = 'safevault.sync.device-id.v1';

export type SyncPhase = 'idle' | 'loading' | 'merging' | 'saving' | 'complete' | 'error';

export interface SyncSnapshot {
  phase: SyncPhase;
  lastSyncedAt: string | null;
  error: string | null;
  remoteDocumentCount: number;
}

type SyncListener = (snapshot: SyncSnapshot) => void;

let snapshot: SyncSnapshot = {
  phase: 'idle',
  lastSyncedAt: null,
  error: null,
  remoteDocumentCount: 0,
};
const listeners = new Set<SyncListener>();
let inFlight: Promise<VaultDocument[]> | null = null;

function publish(patch: Partial<SyncSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => {
    try { listener(snapshot); } catch { /* observers must not break sync */ }
  });
}

async function getDeviceId(): Promise<string> {
  const current = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (current) return current;
  const generated = 'device_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  await AsyncStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

function manifestEntryToDocument(
  entry: ManifestDocEntry,
  existing?: VaultDocument
): VaultDocument {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    ownerId: entry.ownerId,
    fileId: entry.current.fileId,
    localUri: existing?.localUri ?? null,
    mimeType: entry.current.mimeType ?? existing?.mimeType,
    size: entry.current.size ?? existing?.size,
    fileHash: entry.current.fileHash ?? existing?.fileHash,
    encrypted: true,
    storageMode: existing?.storageMode ?? 'drive',
    syncState: entry.current.fileId ? 'synced' : (existing?.syncState ?? 'pending-upload'),
    syncError: null,
    issueDate: entry.issueDate ?? undefined,
    expiryDate: entry.expiryDate ?? undefined,
    notes: entry.notes ?? undefined,
    reminder: entry.reminder,
    reminderTime: existing?.reminderTime,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function sameManifestEntry(a: ManifestDocEntry, b: ManifestDocEntry): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function toManifestEntry(doc: VaultDocument, previous?: ManifestDocEntry): ManifestDocEntry {
  const next = MetadataManager.docToManifestEntry(doc, previous?.driveFolderId ?? null);
  if (!previous) return next;
  // Preserve version history and current version number when the same Drive file
  // is being reconciled. Version creation is handled by the versioning milestone.
  return {
    ...next,
    current: {
      ...next.current,
      version: previous.current.fileId === doc.fileId
        ? previous.current.version
        : Math.max(previous.current.version + 1, next.current.version),
    },
    history: previous.history,
  };
}

export const SyncManager = {
  subscribe(listener: SyncListener): () => void {
    listeners.add(listener);
    listener(snapshot);
    return () => listeners.delete(listener);
  },

  getSnapshot(): SyncSnapshot {
    return snapshot;
  },

  /**
   * Pull remote metadata and merge it with the local document index.
   * This does not download or decrypt document content.
   */
  async sync(user: AuthUser): Promise<VaultDocument[]> {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        if (!user || user.demo || !user.accessToken) {
          throw new Error('Google Drive sync requires an authenticated, non-demo user.');
        }

        publish({ phase: 'loading', error: null });
        // Ensure the SafeVault hierarchy exists before reading/writing its manifest.
        await FolderManager.ensureRoot(user);
        const deviceId = await getDeviceId();
        const loaded = await MetadataManager.load(user, deviceId, APP_VERSION);
        const manifest: VaultManifest = loaded.manifest;

        // Never silently replace a corrupt manifest with an empty one. MetadataManager.load
        // throws ManifestCorruptedError if both primary and backup fail.
        const localDocs = await storage.getDocs();
        const localById = new Map(localDocs.map((doc) => [doc.id, doc]));
        const manifestById = new Map(manifest.documents.map((entry) => [entry.id, entry]));
        const mergedById = new Map<string, VaultDocument>();
        let manifestChanged = false;

        publish({ phase: 'merging', remoteDocumentCount: manifest.documents.filter((d) => !d.deleted).length });

        // Start with local docs so offline, local-only and not-yet-uploaded files survive.
        for (const doc of localDocs) mergedById.set(doc.id, doc);

        // Remote tombstones remove the item from the active list but do not delete its bytes.
        for (const entry of manifest.documents) {
          const existing = localById.get(entry.id);
          if (entry.deleted) {
            // Preserve pending local edits/uploads; an older remote tombstone must not
            // erase a document that this device has not successfully synced yet.
            if (existing && ['pending-upload', 'uploading', 'failed', 'local-only'].includes(existing.syncState ?? '')) continue;
            mergedById.delete(entry.id);
            continue;
          }
          // Never replace interrupted local edits/uploads with potentially stale remote metadata.
          if (existing && ['pending-upload', 'uploading', 'failed', 'local-only'].includes(existing.syncState ?? '')) continue;
          mergedById.set(entry.id, manifestEntryToDocument(entry, existing));
        }

        // Fold already-uploaded local documents into the manifest if they were not indexed.
        // Local-only and pending uploads remain local until their upload completes.
        for (const doc of localDocs) {
          if (doc.fileId && doc.syncState !== 'pending-upload' && doc.syncState !== 'uploading') {
            const previous = manifestById.get(doc.id);
            const entry = toManifestEntry(doc, previous);
            if (!previous || !sameManifestEntry(previous, entry)) {
              manifest.documents = MetadataManager.applyDocUpsert(manifest, entry).documents;
              manifestChanged = true;
            }
          }
        }

        let finalDocs = Array.from(mergedById.values());
        if (manifestChanged || loaded.isEmpty) {
          publish({ phase: 'saving' });
          const saved = await MetadataManager.save(user, manifest);
          // Preserve the returned revision/timestamps for future operations in this session.
          snapshot = { ...snapshot, lastSyncedAt: saved.manifest.updatedAt };
        }

        await storage.setDocs(finalDocs);
        publish({
          phase: 'complete',
          lastSyncedAt: new Date().toISOString(),
          error: null,
          remoteDocumentCount: manifest.documents.filter((d) => !d.deleted).length,
        });
        return finalDocs;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error';
        publish({ phase: 'error', error: message });
        throw error;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },

  /**
   * Update the manifest after a successful Drive upload or metadata edit.
   * Call only after the corresponding document is safely persisted locally.
   */
  async upsertDocument(user: AuthUser, doc: VaultDocument): Promise<void> {
    if (!user || user.demo || !user.accessToken) return;
    const deviceId = await getDeviceId();
    const loaded = await MetadataManager.load(user, deviceId, APP_VERSION);
    const previous = loaded.manifest.documents.find((entry) => entry.id === doc.id);
    const entry = toManifestEntry(doc, previous);
    const next = MetadataManager.applyDocUpsert(loaded.manifest, entry);
    await MetadataManager.save(user, next);
  },

  /**
   * Soft-delete a document in the manifest. No remote bytes are permanently deleted here.
   * Garbage collection must separately enforce the tombstone's hardDeleteAfter time.
   */
  async softDeleteDocument(user: AuthUser, docId: string): Promise<void> {
    if (!user || user.demo || !user.accessToken) return;
    const deviceId = await getDeviceId();
    const loaded = await MetadataManager.load(user, deviceId, APP_VERSION);
    if (loaded.isEmpty) return;
    const next = MetadataManager.applyDocSoftDelete(loaded.manifest, docId, 24);
    await MetadataManager.save(user, next);
  },
};

export default SyncManager;
