import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VaultDocument, VaultEvent, FamilyMember, AuthUser, DriveUsage } from '../types';

const K = {
  DOCS: 'safevault.docs',
  EVENTS: 'safevault.events',
  FAMILY: 'safevault.family',
  USER: 'safevault.user',
  DRIVE: 'safevault.drive',
  SEEDED: 'safevault.seeded.v1',
  RETRY_QUEUE: 'safevault.retry.queue.v1',
};

/** Persisted retry-queue index. Ciphertext lives on disk via saveEncryptedLocal. */
export interface RetryQueueEntry {
  docId: string;
  fileId: string;        // local fake id used as filename for ciphertext
  name: string;
  mimeType: string;
  retryCount: number;
}

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  // Documents
  getDocs: (): Promise<VaultDocument[]> => getJSON(K.DOCS, []),
  setDocs: (docs: VaultDocument[]) => setJSON(K.DOCS, docs),

  // Events
  getEvents: (): Promise<VaultEvent[]> => getJSON(K.EVENTS, []),
  setEvents: (e: VaultEvent[]) => setJSON(K.EVENTS, e),

  // Family
  getFamily: (): Promise<FamilyMember[]> => getJSON(K.FAMILY, []),
  setFamily: (m: FamilyMember[]) => setJSON(K.FAMILY, m),

  // User
  getUser: (): Promise<AuthUser | null> => getJSON<AuthUser | null>(K.USER, null),
  setUser: (u: AuthUser | null) => setJSON(K.USER, u),

  // Drive usage (demo)
  getDrive: (): Promise<DriveUsage> =>
    getJSON(K.DRIVE, { total: 15 * 1024 * 1024 * 1024, used: 0, vault: 0 }),
  setDrive: (d: DriveUsage) => setJSON(K.DRIVE, d),

  // Seeded flag
  isSeeded: async (): Promise<boolean> => (await AsyncStorage.getItem(K.SEEDED)) === '1',
  markSeeded: () => AsyncStorage.setItem(K.SEEDED, '1'),

  // Persistent retry queue (survives app restarts)
  getRetryQueue: (): Promise<RetryQueueEntry[]> => getJSON(K.RETRY_QUEUE, []),
  setRetryQueue: (q: RetryQueueEntry[]) => setJSON(K.RETRY_QUEUE, q),

  // Clear all
  clearAll: async () => {
    await AsyncStorage.multiRemove(Object.values(K));
  },
};
