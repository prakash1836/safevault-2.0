// Persistent upload queue — Sprint 3 of Phase 2.
//
// One key in AsyncStorage: `safevault.upload.queue.v1`. That's it.
//
// AsyncStorage is chosen (not SQLite) because the queue is small (< 100 entries
// typically), the value is a single JSON blob, and we need it to work on all
// platforms including web where SQLite is a no-op stub. Reads/writes are
// serialized through a small in-memory mutex so concurrent producers cannot
// clobber one another.
//
// The queue only stores POINTERS to encrypted local ciphertext (never the
// ciphertext itself) — so it stays tiny and re-hydratable across app restarts.

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'safevault.upload.queue.v1';

export type QueueItemStatus = 'pending' | 'in-progress' | 'failed';

export interface UploadQueueItem {
  /** Stable id, unique per queue item. */
  id: string;
  /** VaultDocument.id — cross-reference to the doc this upload is for. */
  docId: string;
  /** Category needed by FolderManager.ensureDocFolder. */
  category: string;
  /** Filename to use on Drive (e.g. `v1.enc`). */
  fileName: string;
  /** Pointer to the encrypted local file on disk (services/drive#saveEncryptedLocal). Nullable on web. */
  localCipherPath: string | null;
  /** MIME of the ORIGINAL plaintext (not the ciphertext). Preserved in Drive metadata. */
  mimeType: string;
  /** Size of the plaintext in bytes. */
  size: number;
  /** SHA-256 (hex) of the plaintext — for integrity check on download. */
  fileHash: string | null;
  /** Version this upload represents (Sprint 5 versioning; defaults to 1). */
  version: number;
  /** Timestamps + retry bookkeeping. */
  queuedAt: string;
  lastAttemptAt: string | null;
  attempts: number;
  lastError: string | null;
  status: QueueItemStatus;
}

/* -------------------------------------------------------------------------- */
/* In-memory serialisation                                                    */
/* -------------------------------------------------------------------------- */

let flushChain: Promise<void> = Promise.resolve();

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = flushChain;
  let release: () => void = () => {};
  flushChain = new Promise<void>((r) => { release = r; });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function readRaw(): Promise<UploadQueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as UploadQueueItem[];
    return [];
  } catch {
    return [];
  }
}

async function writeRaw(items: UploadQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export const UploadQueue = {
  KEY: QUEUE_KEY,

  /** Return the current queue snapshot. */
  async list(): Promise<UploadQueueItem[]> {
    return withLock(readRaw);
  },

  /** Return one item by queue-id, or null. */
  async find(id: string): Promise<UploadQueueItem | null> {
    const items = await withLock(readRaw);
    return items.find((i) => i.id === id) || null;
  },

  /** Return the first item that matches `docId`, or null. */
  async findByDocId(docId: string): Promise<UploadQueueItem | null> {
    const items = await withLock(readRaw);
    return items.find((i) => i.docId === docId) || null;
  },

  /** Enqueue a new item (appends). */
  async enqueue(item: Omit<UploadQueueItem, 'queuedAt' | 'lastAttemptAt' | 'attempts' | 'lastError' | 'status'>): Promise<UploadQueueItem> {
    return withLock(async () => {
      const now = new Date().toISOString();
      const items = await readRaw();
      const full: UploadQueueItem = {
        ...item,
        queuedAt: now,
        lastAttemptAt: null,
        attempts: 0,
        lastError: null,
        status: 'pending',
      };
      items.push(full);
      await writeRaw(items);
      return full;
    });
  },

  /** Patch a queue item by id. Returns the updated item or null. */
  async update(id: string, patch: Partial<UploadQueueItem>): Promise<UploadQueueItem | null> {
    return withLock(async () => {
      const items = await readRaw();
      const idx = items.findIndex((i) => i.id === id);
      if (idx < 0) return null;
      items[idx] = { ...items[idx], ...patch };
      await writeRaw(items);
      return items[idx];
    });
  },

  /** Remove a queue item by id. */
  async remove(id: string): Promise<void> {
    return withLock(async () => {
      const items = await readRaw();
      const next = items.filter((i) => i.id !== id);
      if (next.length !== items.length) await writeRaw(next);
    });
  },

  /** Remove every queue item pointing at the given docId. */
  async removeByDocId(docId: string): Promise<void> {
    return withLock(async () => {
      const items = await readRaw();
      const next = items.filter((i) => i.docId !== docId);
      if (next.length !== items.length) await writeRaw(next);
    });
  },

  /** Count items by status. */
  async count(status?: QueueItemStatus): Promise<number> {
    const items = await withLock(readRaw);
    return status ? items.filter((i) => i.status === status).length : items.length;
  },

  /** Test / recovery helper — wipe the queue. */
  async clear(): Promise<void> {
    return withLock(async () => {
      await AsyncStorage.removeItem(QUEUE_KEY);
    });
  },
};
