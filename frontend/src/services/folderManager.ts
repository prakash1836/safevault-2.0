// FolderManager — folder discovery and creation only.
// Sprint 1 of Phase 2. Architecture rule: this file MUST only concern itself with
// Drive folders. It never uploads document bytes, never touches the manifest,
// and never talks to the UI. All state is cached in AsyncStorage so subsequent
// launches skip Drive round-trips.
//
// Folder hierarchy on Drive:
//   SafeVault/                     (root)
//   ├── manifest/                  (holds metadata.json + metadata.json.bak)
//   ├── docs/                      (parent of category subfolders)
//   │   └── <Category>/            (created LAZILY on first upload in that category)
//   │       └── <docId>/           (created LAZILY on first upload of that document)
//   ├── events/                    (reserved for Phase 2.1)
//   └── family/                    (reserved for Family Vault, §15 of the design)

import type { AuthUser, DocCategory } from '../types';
import { storage, type DriveSubfolders } from './storage';
import {
  findFileOnDrive,
  createFolderOnDrive,
  type DriveFileRef,
} from './drive';

const ROOT_NAME = 'SafeVault';
const APP_TAG = { key: 'safevault', value: '1' };

export type SafeVaultRole = 'root' | 'manifest' | 'docs' | 'events' | 'family' | 'category' | 'doc';

/* -------------------------------------------------------------------------- */
/* In-memory cache — avoids a re-hydrate from AsyncStorage on every call.     */
/* -------------------------------------------------------------------------- */

interface Cache {
  rootId: string | null;
  subfolders: DriveSubfolders;
  categoryFolders: Partial<Record<DocCategory, string>>;
  docFolders: Record<string, string>;
  hydrated: boolean;
}

const cache: Cache = {
  rootId: null,
  subfolders: { manifest: null, docs: null, events: null, family: null },
  categoryFolders: {},
  docFolders: {},
  hydrated: false,
};

/** Load cached folder IDs from AsyncStorage into memory. Called on first use. */
async function hydrate(): Promise<void> {
  if (cache.hydrated) return;
  const [rootId, subs, cats, docs] = await Promise.all([
    storage.getDriveRootId(),
    storage.getDriveSubfolders(),
    storage.getDriveCategoryFolders(),
    storage.getDriveDocFolders(),
  ]);
  cache.rootId = rootId;
  cache.subfolders = subs;
  cache.categoryFolders = cats;
  cache.docFolders = docs;
  cache.hydrated = true;
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

async function findOrCreateFolder(
  user: AuthUser,
  name: string,
  parentId: string | undefined,
  appProperties: Record<string, string>
): Promise<string> {
  // Look up an existing folder by name + parent + tags.
  const existing: DriveFileRef | null = await findFileOnDrive(user, {
    name,
    parentId,
    onlyFolders: true,
    appProperties,
  });
  if (existing) return existing.id;
  return createFolderOnDrive(user, name, parentId, appProperties);
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export const FolderManager = {
  /**
   * Ensure the root `SafeVault/` folder exists. Cached forever until `invalidateCache()`.
   * Returns the root folder's Drive `fileId`.
   */
  async ensureRoot(user: AuthUser): Promise<string> {
    await hydrate();
    if (cache.rootId) return cache.rootId;

    const id = await findOrCreateFolder(user, ROOT_NAME, undefined, {
      [APP_TAG.key]: APP_TAG.value,
      'safevault.role': 'root',
    });
    cache.rootId = id;
    await storage.setDriveRootId(id);
    return id;
  },

  /**
   * Ensure the given first-level subfolder exists under `SafeVault/`. Cached.
   */
  async ensureSubfolder(user: AuthUser, role: 'manifest' | 'docs' | 'events' | 'family'): Promise<string> {
    await hydrate();
    const cached = cache.subfolders[role];
    if (cached) return cached;

    const rootId = await FolderManager.ensureRoot(user);
    const id = await findOrCreateFolder(user, role, rootId, {
      [APP_TAG.key]: APP_TAG.value,
      'safevault.role': role,
    });
    cache.subfolders = { ...cache.subfolders, [role]: id };
    await storage.setDriveSubfolders(cache.subfolders);
    return id;
  },

  /**
   * Ensure the per-category folder under `SafeVault/docs/<Category>/` exists.
   * Created LAZILY on first upload in a category, per the sprint requirement.
   */
  async ensureCategoryFolder(user: AuthUser, category: DocCategory): Promise<string> {
    await hydrate();
    const cached = cache.categoryFolders[category];
    if (cached) return cached;

    const docsId = await FolderManager.ensureSubfolder(user, 'docs');
    const id = await findOrCreateFolder(user, category, docsId, {
      [APP_TAG.key]: APP_TAG.value,
      'safevault.role': 'category',
      'safevault.category': category,
    });
    cache.categoryFolders = { ...cache.categoryFolders, [category]: id };
    await storage.setDriveCategoryFolders(cache.categoryFolders);
    return id;
  },

  /**
   * Ensure the per-document folder under `SafeVault/docs/<Category>/<docId>/` exists.
   * Created LAZILY on the first version-upload of the document.
   */
  async ensureDocFolder(user: AuthUser, docId: string, category: DocCategory): Promise<string> {
    await hydrate();
    const cached = cache.docFolders[docId];
    if (cached) return cached;

    const categoryId = await FolderManager.ensureCategoryFolder(user, category);
    const id = await findOrCreateFolder(user, docId, categoryId, {
      [APP_TAG.key]: APP_TAG.value,
      'safevault.role': 'doc',
      'safevault.docId': docId,
      'safevault.category': category,
    });
    cache.docFolders = { ...cache.docFolders, [docId]: id };
    await storage.setDriveDocFolders(cache.docFolders);
    return id;
  },

  /**
   * Read-only accessors for the current cache. Never triggers a Drive round-trip.
   * Higher layers (SyncManager) use these to know what's been discovered so far.
   */
  async getCache(): Promise<{
    rootId: string | null;
    subfolders: DriveSubfolders;
    categoryFolders: Partial<Record<DocCategory, string>>;
    docFolders: Record<string, string>;
  }> {
    await hydrate();
    return {
      rootId: cache.rootId,
      subfolders: cache.subfolders,
      categoryFolders: { ...cache.categoryFolders },
      docFolders: { ...cache.docFolders },
    };
  },

  /**
   * Forget a single document's folder mapping. Called by SyncManager after a
   * two-phase delete completes and the docs/<Category>/<docId>/ folder is trashed.
   */
  async forgetDocFolder(docId: string): Promise<void> {
    await hydrate();
    if (!(docId in cache.docFolders)) return;
    const next = { ...cache.docFolders };
    delete next[docId];
    cache.docFolders = next;
    await storage.setDriveDocFolders(cache.docFolders);
  },

  /**
   * Nuke the in-memory + persisted folder cache. Used by SyncManager on user
   * logout or when the manifest fails to load and we need to re-discover.
   */
  async invalidateCache(): Promise<void> {
    cache.rootId = null;
    cache.subfolders = { manifest: null, docs: null, events: null, family: null };
    cache.categoryFolders = {};
    cache.docFolders = {};
    cache.hydrated = true; // stay hydrated so subsequent hits go through the API paths
    await storage.clearDriveCache();
  },
};

// Named-export the type union too so tests / SyncManager can type-check role strings.
export const SAFEVAULT_APP_TAG = APP_TAG;
