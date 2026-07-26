// SQLite metadata cache — Sprint 2 of Phase 2.
//
// Architecture rule: SQLite stores ONLY document metadata. It never holds
// encrypted document contents, thumbnails, previews or OCR payloads. Those
// live in the encrypted local cache (services/drive.ts) and on Google Drive.
//
// The database is a mirror of the on-Drive `metadata.json`. Drive remains the
// source of truth; SQLite is a fast local index for reads.
//
// On web, expo-sqlite requires WASM. We short-circuit to a no-op driver so
// the app still runs in the browser preview — SyncManager will fall back to
// the AsyncStorage-backed reads until native builds pick up the SQLite path.

import { Platform } from 'react-native';
import type { DocCategory, DocReminder } from '../types';

export interface SqliteDocument {
  id: string;
  name: string;
  category: DocCategory;
  ownerId: string;
  fileId: string | null;
  driveFolderId: string | null;
  localUri: string | null;
  mimeType: string | null;
  size: number | null;
  fileHash: string | null;
  version: number;
  issueDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  reminder: DocReminder;
  createdAt: string;
  updatedAt: string;
}

export interface SqliteTombstone {
  docId: string;
  deletedAt: string;
  hardDeleteAfter: string;
}

export interface SqliteCategory {
  name: DocCategory;
  driveFolderId: string | null;
  createdAt: string;
}

export interface ManifestMeta {
  schemaVersion: number;
  revision: number;
  vaultId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  deviceId: string | null;
  appVersion: string | null;
  hash: string | null;
}

const DB_NAME = 'safevault_v2.db';
const IS_WEB = Platform.OS === 'web';

/* -------------------------------------------------------------------------- */
/* Driver — native SQLite or no-op stub for web                               */
/* -------------------------------------------------------------------------- */

interface Driver {
  ready: boolean;
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: any[]): Promise<void>;
  getFirstAsync<T = any>(sql: string, params?: any[]): Promise<T | null>;
  getAllAsync<T = any>(sql: string, params?: any[]): Promise<T[]>;
}

let driver: Driver | null = null;

async function loadNativeDriver(): Promise<Driver> {
  // Dynamic import so the web bundle doesn't try to resolve the native binding.
  const SQLite = await import('expo-sqlite');
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  return {
    ready: true,
    execAsync: (sql) => db.execAsync(sql),
    runAsync: async (sql, params = []) => {
      await db.runAsync(sql, params);
    },
    getFirstAsync: (sql, params = []) => db.getFirstAsync<any>(sql, params),
    getAllAsync: (sql, params = []) => db.getAllAsync<any>(sql, params),
  };
}

function webStub(): Driver {
  const warn = (op: string) => {
    // eslint-disable-next-line no-console
    console.debug('[sqlite] ' + op + ' skipped on web');
  };
  return {
    ready: false,
    execAsync: async () => { warn('execAsync'); },
    runAsync: async () => { warn('runAsync'); },
    getFirstAsync: async () => { warn('getFirstAsync'); return null; },
    getAllAsync: async () => { warn('getAllAsync'); return []; },
  };
}

async function getDriver(): Promise<Driver> {
  if (driver) return driver;
  if (IS_WEB) { driver = webStub(); return driver; }
  try {
    driver = await loadNativeDriver();
  } catch (e) {
    // Any load failure → degrade gracefully.
    // eslint-disable-next-line no-console
    console.warn('[sqlite] native driver load failed; degrading to no-op:', e);
    driver = webStub();
  }
  return driver;
}

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS manifest_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  name           TEXT PRIMARY KEY,
  driveFolderId  TEXT,
  createdAt      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL,
  ownerId        TEXT NOT NULL,
  fileId         TEXT,
  driveFolderId  TEXT,
  localUri       TEXT,
  mimeType       TEXT,
  size           INTEGER,
  fileHash       TEXT,
  version        INTEGER NOT NULL DEFAULT 1,
  issueDate      TEXT,
  expiryDate     TEXT,
  notes          TEXT,
  reminder       TEXT NOT NULL DEFAULT '{"days30":true,"days7":true,"days1":true}',
  createdAt      TEXT NOT NULL,
  updatedAt      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_category  ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_expiry    ON documents(expiryDate);
CREATE INDEX IF NOT EXISTS idx_documents_updatedAt ON documents(updatedAt);

CREATE TABLE IF NOT EXISTS tombstones (
  docId             TEXT PRIMARY KEY,
  deletedAt         TEXT NOT NULL,
  hardDeleteAfter   TEXT NOT NULL
);
`;

async function applySchema(): Promise<void> {
  const d = await getDriver();
  if (!d.ready) return;
  await d.execAsync(SCHEMA_SQL);
}

/* -------------------------------------------------------------------------- */
/* Serialisation helpers                                                      */
/* -------------------------------------------------------------------------- */

function rowToDoc(row: any): SqliteDocument {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    ownerId: row.ownerId,
    fileId: row.fileId ?? null,
    driveFolderId: row.driveFolderId ?? null,
    localUri: row.localUri ?? null,
    mimeType: row.mimeType ?? null,
    size: row.size ?? null,
    fileHash: row.fileHash ?? null,
    version: Number(row.version || 1),
    issueDate: row.issueDate ?? null,
    expiryDate: row.expiryDate ?? null,
    notes: row.notes ?? null,
    reminder: safeJson<DocReminder>(row.reminder, { days30: true, days7: true, days1: true }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

/* -------------------------------------------------------------------------- */
/* Public API — narrow surface, exercised by MetadataManager & Migration      */
/* -------------------------------------------------------------------------- */

export const sqlite = {
  /** Open the DB and apply the schema. Idempotent. */
  async init(): Promise<void> {
    await applySchema();
  },

  /** True if SQLite is available on this platform (i.e. not web). */
  async isReady(): Promise<boolean> {
    const d = await getDriver();
    return d.ready;
  },

  /* -- documents ---------------------------------------------------------- */

  async upsertDocument(doc: SqliteDocument): Promise<void> {
    const d = await getDriver();
    if (!d.ready) return;
    await d.runAsync(
      `INSERT INTO documents
         (id,name,category,ownerId,fileId,driveFolderId,localUri,mimeType,size,fileHash,version,issueDate,expiryDate,notes,reminder,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         category=excluded.category,
         ownerId=excluded.ownerId,
         fileId=excluded.fileId,
         driveFolderId=excluded.driveFolderId,
         localUri=excluded.localUri,
         mimeType=excluded.mimeType,
         size=excluded.size,
         fileHash=excluded.fileHash,
         version=excluded.version,
         issueDate=excluded.issueDate,
         expiryDate=excluded.expiryDate,
         notes=excluded.notes,
         reminder=excluded.reminder,
         updatedAt=excluded.updatedAt`,
      [
        doc.id, doc.name, doc.category, doc.ownerId,
        doc.fileId, doc.driveFolderId, doc.localUri, doc.mimeType,
        doc.size, doc.fileHash, doc.version,
        doc.issueDate, doc.expiryDate, doc.notes,
        JSON.stringify(doc.reminder),
        doc.createdAt, doc.updatedAt,
      ]
    );
  },

  async removeDocument(id: string): Promise<void> {
    const d = await getDriver();
    if (!d.ready) return;
    await d.runAsync('DELETE FROM documents WHERE id = ?', [id]);
  },

  async listDocuments(): Promise<SqliteDocument[]> {
    const d = await getDriver();
    if (!d.ready) return [];
    const rows = await d.getAllAsync<any>('SELECT * FROM documents ORDER BY updatedAt DESC');
    return rows.map(rowToDoc);
  },

  async getDocument(id: string): Promise<SqliteDocument | null> {
    const d = await getDriver();
    if (!d.ready) return null;
    const row = await d.getFirstAsync<any>('SELECT * FROM documents WHERE id = ?', [id]);
    return row ? rowToDoc(row) : null;
  },

  async countDocuments(): Promise<number> {
    const d = await getDriver();
    if (!d.ready) return 0;
    const row = await d.getFirstAsync<any>('SELECT COUNT(*) as c FROM documents');
    return Number(row?.c || 0);
  },

  /* -- categories --------------------------------------------------------- */

  async upsertCategory(c: SqliteCategory): Promise<void> {
    const d = await getDriver();
    if (!d.ready) return;
    await d.runAsync(
      `INSERT INTO categories (name, driveFolderId, createdAt)
       VALUES (?,?,?)
       ON CONFLICT(name) DO UPDATE SET driveFolderId=excluded.driveFolderId`,
      [c.name, c.driveFolderId, c.createdAt]
    );
  },

  async listCategories(): Promise<SqliteCategory[]> {
    const d = await getDriver();
    if (!d.ready) return [];
    return await d.getAllAsync<SqliteCategory>('SELECT * FROM categories ORDER BY name');
  },

  /* -- tombstones --------------------------------------------------------- */

  async addTombstone(t: SqliteTombstone): Promise<void> {
    const d = await getDriver();
    if (!d.ready) return;
    await d.runAsync(
      `INSERT INTO tombstones (docId, deletedAt, hardDeleteAfter)
       VALUES (?,?,?)
       ON CONFLICT(docId) DO UPDATE SET
         deletedAt=excluded.deletedAt,
         hardDeleteAfter=excluded.hardDeleteAfter`,
      [t.docId, t.deletedAt, t.hardDeleteAfter]
    );
  },

  async removeTombstone(docId: string): Promise<void> {
    const d = await getDriver();
    if (!d.ready) return;
    await d.runAsync('DELETE FROM tombstones WHERE docId = ?', [docId]);
  },

  async listTombstones(): Promise<SqliteTombstone[]> {
    const d = await getDriver();
    if (!d.ready) return [];
    return await d.getAllAsync<SqliteTombstone>('SELECT * FROM tombstones ORDER BY deletedAt DESC');
  },

  /* -- manifest metadata (singleton k/v table) ---------------------------- */

  async getMeta(): Promise<ManifestMeta> {
    const d = await getDriver();
    const empty: ManifestMeta = {
      schemaVersion: 1,
      revision: 0,
      vaultId: null,
      createdAt: null,
      updatedAt: null,
      deviceId: null,
      appVersion: null,
      hash: null,
    };
    if (!d.ready) return empty;
    const rows = await d.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM manifest_meta');
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return {
      schemaVersion: Number(map.schemaVersion || 1),
      revision: Number(map.revision || 0),
      vaultId: map.vaultId || null,
      createdAt: map.createdAt || null,
      updatedAt: map.updatedAt || null,
      deviceId: map.deviceId || null,
      appVersion: map.appVersion || null,
      hash: map.hash || null,
    };
  },

  async setMeta(patch: Partial<ManifestMeta>): Promise<void> {
    const d = await getDriver();
    if (!d.ready) return;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      await d.runAsync(
        `INSERT INTO manifest_meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        [k, v === null ? '' : String(v)]
      );
    }
  },

  /** Wipe every table. Called only from tests or a user-initiated factory reset. */
  async clear(): Promise<void> {
    const d = await getDriver();
    if (!d.ready) return;
    await d.execAsync(`
      DELETE FROM documents;
      DELETE FROM categories;
      DELETE FROM tombstones;
      DELETE FROM manifest_meta;
    `);
  },
};
