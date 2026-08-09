// UploadCoordinator — Sprint 3 of Phase 2.
//
// Orchestrates the new upload workflow:
//
//    User selects document
//        ↓
//    Encrypt                                (services/encryption)
//        ↓
//    Save encrypted local cache             (services/drive#saveEncryptedLocal)
//        ↓
//    Create SQLite metadata entry           (services/sqlite#upsertDocument)
//        ↓
//    Create upload queue item               (services/uploadQueue#enqueue)
//        ↓
//    Background upload
//        ↓
//    FolderManager                          (services/folderManager#ensureDocFolder)
//        ↓
//    Drive upload                           (services/drive#uploadToDrive)
//        ↓
//    MetadataManager update                 (in-process — deferred to SyncManager in Sprint 4)
//        ↓
//    Mark document as Synced
//        ↓
//    Complete
//
// VaultContext calls `submit()` on the coordinator with a doc + ciphertext. The
// coordinator returns as soon as the doc is safely persisted locally + queued.
// It then attempts the network upload in the background; sync-state transitions
// are broadcast via `subscribe(cb)`. Callers do NOT need to await the network
// hop for the operation to be safe against network failures.
//
// This module is intentionally UI-agnostic — VaultContext is the sole consumer.

import type { AuthUser, VaultDocument, SyncState, StorageMode } from '../types';
import { encryptBase64, getKey } from './encryption';
import { saveEncryptedLocal, uploadToDrive, deleteEncryptedLocal } from './drive';
import { FolderManager } from './folderManager';
import { UploadQueue, type UploadQueueItem } from './uploadQueue';
import { sqlite } from './sqlite';

/** Reported on every sync-state transition. */
export interface CoordinatorEvent {
  docId: string;
  state: SyncState;
  progress?: number;
  fileId?: string | null;
  driveFolderId?: string | null;
  localUri?: string | null;
  error?: string;
}

type Listener = (ev: CoordinatorEvent) => void;

const RETRY_INTERVAL_MS = 30_000;
const BACKOFF_STEPS_MS = [2_000, 5_000, 15_000, 60_000];

function backoffFor(attempts: number): number {
  const idx = Math.min(attempts - 1, BACKOFF_STEPS_MS.length - 1);
  return BACKOFF_STEPS_MS[Math.max(0, idx)];
}

class Coordinator {
  private user: AuthUser | null = null;
  private listeners = new Set<Listener>();
  private processing = false;
  private retryTimer: ReturnType<typeof setInterval> | null = null;

  /** Called by VaultContext when the auth session becomes available. */
  setUser(user: AuthUser | null) {
    this.user = user;
    // Kick a queue drain in the background whenever we (re-)acquire a user.
    if (user) {
      void this.processQueue();
      this.startRetryLoop();
    } else {
      this.stopRetryLoop();
    }
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  private emit(ev: CoordinatorEvent) {
    for (const l of this.listeners) {
      try { l(ev); } catch {}
    }
  }

  private startRetryLoop() {
    if (this.retryTimer) return;
    this.retryTimer = setInterval(() => {
      void this.processQueue();
    }, RETRY_INTERVAL_MS);
  }

  private stopRetryLoop() {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Submit — the atomic user-triggered path                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Persist a new document safely, then attempt an immediate upload.
   *
   * Returns as soon as the document is durable on-device. The network hop is
   * best-effort — a failure leaves the item in the queue for later retry, but
   * never causes the operation to reject. The caller sees the eventual state
   * either through the resolved `SubmitResult` (immediate attempt outcome) or
   * through the `subscribe` stream.
   */
  async submit(input: {
    doc: Omit<VaultDocument, 'encrypted' | 'localUri' | 'fileId' | 'syncState'> & {
      fileBase64: string;
      /** Where to persist. `undefined` → `'both'` for backwards compat. */
      storageMode?: StorageMode;
    };
    onProgress?: (p: number) => void;
  }): Promise<SubmitResult> {
    if (!this.user) throw new Error('UploadCoordinator has no user session');
    const user = this.user;
    const storageMode: StorageMode = input.doc.storageMode || 'both';
    const wantsLocal = storageMode === 'local' || storageMode === 'both';
    const wantsDrive = storageMode === 'drive' || storageMode === 'both';

    // 1. Encrypt
    const key = await getKey();
    if (!key) throw new Error('Missing encryption key');
    const cipher = encryptBase64(input.doc.fileBase64, key);

    // 2. Local encrypted cache (skipped when the user chose Drive-only)
    const localCipherPath = wantsLocal ? await saveEncryptedLocal(input.doc.id, cipher) : null;

    // 3. Build durable VaultDocument shell.
    //    For local-only uploads there is no Drive hop, so sync state jumps
    //    straight to a terminal 'local-only' — no queue entry, no retry loop.
    const now = new Date().toISOString();
    const initialSyncState: SyncState = wantsDrive ? 'pending-upload' : 'local-only';
    const durable: VaultDocument = {
      id: input.doc.id,
      name: input.doc.name,
      category: input.doc.category,
      ownerId: input.doc.ownerId,
      fileId: null,
      localUri: localCipherPath,
      mimeType: input.doc.mimeType,
      size: input.doc.size,
      fileHash: input.doc.fileHash,
      encrypted: true,
      storageMode,
      syncState: initialSyncState,
      syncError: null,
      issueDate: input.doc.issueDate,
      expiryDate: input.doc.expiryDate,
      notes: input.doc.notes,
      reminder: input.doc.reminder,
      createdAt: input.doc.createdAt || now,
      updatedAt: now,
    };

    // 4. SQLite metadata entry (idempotent; no-op on web)
    try {
      await sqlite.upsertDocument({
        id: durable.id,
        name: durable.name,
        category: durable.category,
        ownerId: durable.ownerId,
        fileId: null,
        driveFolderId: null,
        localUri: durable.localUri ?? null,
        mimeType: durable.mimeType ?? null,
        size: durable.size ?? null,
        fileHash: durable.fileHash ?? null,
        version: 1,
        issueDate: durable.issueDate ?? null,
        expiryDate: durable.expiryDate ?? null,
        notes: durable.notes ?? null,
        reminder: durable.reminder,
        createdAt: durable.createdAt,
        updatedAt: durable.updatedAt,
      });
    } catch {
      // SQLite is a supplemental cache; failure here must not block the upload.
    }

    // 5. Queue item (persistent — survives restart / reboot / force close)
    //    Skip entirely for local-only uploads: there is nothing to send to Drive.
    if (!wantsDrive) {
      this.emit({
        docId: durable.id,
        state: 'local-only',
        localUri: localCipherPath,
        progress: 1,
      });
      input.onProgress?.(1);
      return { doc: durable, attempt: { status: 'local-only', localUri: localCipherPath } };
    }

    const qItem = await UploadQueue.enqueue({
      id: 'q_' + durable.id + '_' + Date.now().toString(36),
      docId: durable.id,
      category: durable.category,
      fileName: 'v1.enc',
      localCipherPath,
      mimeType: durable.mimeType || 'application/octet-stream',
      size: durable.size || 0,
      fileHash: durable.fileHash ?? null,
      version: 1,
    });

    this.emit({ docId: durable.id, state: 'pending-upload' });

    // 6. Immediate best-effort attempt. Failures do NOT throw here — the item
    //    stays queued and will be retried by the retry loop.
    const attempt = await this.attemptOne(user, qItem, cipher, input.onProgress);

    return { doc: durable, attempt };
  }

  /* ---------------------------------------------------------------------- */
  /* Queue drain — background loop                                          */
  /* ---------------------------------------------------------------------- */

  /**
   * Process every pending item in the queue exactly once, honouring per-item
   * backoff. Multiple concurrent invocations are coalesced into a single pass.
   */
  async processQueue(): Promise<void> {
    if (this.processing) return;
    if (!this.user) return;
    const user = this.user;

    this.processing = true;
    try {
      const items = await UploadQueue.list();
      const now = Date.now();
      for (const item of items) {
        if (item.status === 'in-progress') continue;
        if (item.attempts > 0 && item.lastAttemptAt) {
          const wait = backoffFor(item.attempts);
          if (now - new Date(item.lastAttemptAt).getTime() < wait) continue;
        }
        // Attempt upload — no progress callback for background retries.
        await this.attemptOne(user, item);
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Force an immediate drain regardless of backoff. Used by tests and by a
   * future manual "Sync now" affordance.
   */
  async retryAll(): Promise<void> {
    if (!this.user) return;
    const user = this.user;
    const items = await UploadQueue.list();
    for (const item of items) {
      if (item.status === 'in-progress') continue;
      await this.attemptOne(user, item);
    }
  }

  private async attemptOne(
    user: AuthUser,
    item: UploadQueueItem,
    cipherOverride?: string,
    onProgress?: (p: number) => void
  ): Promise<AttemptResult> {
    // Mark in-progress
    await UploadQueue.update(item.id, { status: 'in-progress' });
    this.emit({ docId: item.docId, state: 'uploading', progress: 0 });

    try {
      const folderId = await FolderManager.ensureDocFolder(user, item.docId, item.category as any);

      // Recover the ciphertext for retries (background loop has no cipherOverride).
      const cipher = cipherOverride ?? await readCipherFromLocal(item);
      if (!cipher) {
        throw new Error('Encrypted local cache is missing — cannot re-upload');
      }

      const fileId = await uploadToDrive(user, item.fileName, cipher, item.mimeType, {
        parentId: folderId,
        appProperties: {
          'safevault': '1',
          'safevault.role': 'doc',
          'safevault.docId': item.docId,
          'safevault.category': item.category,
          'safevault.version': String(item.version || 1),
          'safevault.hash': item.fileHash || '',
        },
        onProgress: (p) => {
          onProgress?.(p);
          this.emit({ docId: item.docId, state: 'uploading', progress: p });
        },
      });

      // SQLite: update fileId + driveFolderId
      try {
        const existing = await sqlite.getDocument(item.docId);
        if (existing) {
          await sqlite.upsertDocument({
            ...existing,
            fileId,
            driveFolderId: folderId,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {}

      await UploadQueue.remove(item.id);
      this.emit({
        docId: item.docId,
        state: 'synced',
        progress: 1,
        fileId,
        driveFolderId: folderId,
        localUri: item.localCipherPath,
      });
      return { status: 'synced', fileId, driveFolderId: folderId };
    } catch (e: any) {
      const msg = e?.message || 'Upload failed';
      const attempts = item.attempts + 1;
      await UploadQueue.update(item.id, {
        status: 'failed',
        attempts,
        lastAttemptAt: new Date().toISOString(),
        lastError: msg,
      });
      this.emit({
        docId: item.docId,
        state: attempts >= 5 ? 'failed' : 'pending-upload',
        error: msg,
      });
      return { status: 'pending', error: msg };
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Cancellation                                                           */
  /* ---------------------------------------------------------------------- */

  /**
   * Called when VaultContext.deleteDoc runs. Removes any pending queue entries
   * so we don't upload a document that the user just deleted.
   */
  async cancelForDoc(docId: string): Promise<void> {
    const items = await UploadQueue.list();
    const gone = items.filter((i) => i.docId === docId);
    if (gone.length === 0) return;
    await UploadQueue.removeByDocId(docId);
    // Best-effort — remove local cipher files for the cancelled uploads.
    for (const g of gone) {
      if (g.localCipherPath) {
        try { await deleteEncryptedLocal(g.localCipherPath); } catch {}
      }
    }
    this.emit({ docId, state: 'deleted' });
  }
}

async function readCipherFromLocal(item: UploadQueueItem): Promise<string | null> {
  if (!item.localCipherPath) return null;
  // Late import to avoid a cycle with services/drive on module init.
  const { readEncryptedLocal } = await import('./drive');
  return readEncryptedLocal(item.localCipherPath);
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface SubmitResult {
  doc: VaultDocument;
  attempt: AttemptResult;
}

export type AttemptResult =
  | { status: 'synced'; fileId: string; driveFolderId: string }
  | { status: 'pending'; error: string }
  | { status: 'local-only'; localUri: string | null };

/* -------------------------------------------------------------------------- */
/* Singleton                                                                  */
/* -------------------------------------------------------------------------- */

/** Global coordinator instance. VaultContext wires it up on login. */
export const UploadCoordinator = new Coordinator();
