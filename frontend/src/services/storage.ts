import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VaultDocument, VaultEvent, FamilyMember, AuthUser, DriveUsage, DocCategory } from '../types';

const K = {
  DOCS: 'safevault.docs',
  EVENTS: 'safevault.events',
  FAMILY: 'safevault.family',
  USER: 'safevault.user',
  DRIVE: 'safevault.drive',
  SEEDED: 'safevault.seeded.v1',
  NOTIF_MAP: 'safevault.notifications.map.v1',
  // Drive folder cache (Sprint 1 — Phase 2)
  DRIVE_ROOT_ID: 'safevault.drive.rootId',
  DRIVE_SUBFOLDERS: 'safevault.drive.subfolders',
  DRIVE_CATEGORY_FOLDERS: 'safevault.drive.categoryFolders',
  DRIVE_DOC_FOLDERS: 'safevault.drive.docFolders',
};

export interface DriveSubfolders {
  manifest: string | null;
  docs: string | null;
  events: string | null;
  family: string | null;
}
const EMPTY_SUBFOLDERS: DriveSubfolders = { manifest: null, docs: null, events: null, family: null };

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

  // Notification ID map: keyed by doc/event id -> string[] of scheduled Expo notification IDs.
  // Persisted so cancellations survive app restarts.
  getReminderMap: (): Promise<Record<string, string[]>> =>
    getJSON<Record<string, string[]>>(K.NOTIF_MAP, {}),
  setReminderMap: (m: Record<string, string[]>) => setJSON(K.NOTIF_MAP, m),

  // ----------------------------------------------------------------
  // Drive folder cache (Phase 2 Sprint 1)
  // Higher-level services (FolderManager) look these IDs up first;
  // if a lookup misses they hit Drive and back-fill the cache.
  // ----------------------------------------------------------------
  getDriveRootId: (): Promise<string | null> =>
    getJSON<string | null>(K.DRIVE_ROOT_ID, null),
  setDriveRootId: (id: string | null) => setJSON(K.DRIVE_ROOT_ID, id),

  getDriveSubfolders: (): Promise<DriveSubfolders> =>
    getJSON<DriveSubfolders>(K.DRIVE_SUBFOLDERS, EMPTY_SUBFOLDERS),
  setDriveSubfolders: (m: DriveSubfolders) => setJSON(K.DRIVE_SUBFOLDERS, m),

  getDriveCategoryFolders: (): Promise<Partial<Record<DocCategory, string>>> =>
    getJSON<Partial<Record<DocCategory, string>>>(K.DRIVE_CATEGORY_FOLDERS, {}),
  setDriveCategoryFolders: (m: Partial<Record<DocCategory, string>>) =>
    setJSON(K.DRIVE_CATEGORY_FOLDERS, m),

  getDriveDocFolders: (): Promise<Record<string, string>> =>
    getJSON<Record<string, string>>(K.DRIVE_DOC_FOLDERS, {}),
  setDriveDocFolders: (m: Record<string, string>) => setJSON(K.DRIVE_DOC_FOLDERS, m),

  /** Wipe every Drive-cache key. Used on logout and on `FolderManager.invalidateCache()`. */
  clearDriveCache: async () => {
    await AsyncStorage.multiRemove([
      K.DRIVE_ROOT_ID,
      K.DRIVE_SUBFOLDERS,
      K.DRIVE_CATEGORY_FOLDERS,
      K.DRIVE_DOC_FOLDERS,
    ]);
  },

  // Seeded flag
  isSeeded: async (): Promise<boolean> => (await AsyncStorage.getItem(K.SEEDED)) === '1',
  markSeeded: () => AsyncStorage.setItem(K.SEEDED, '1'),

  // Clear all
  clearAll: async () => {
    await AsyncStorage.multiRemove(Object.values(K));
  },
};
