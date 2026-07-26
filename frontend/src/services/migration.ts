// One-time migration — Sprint 2 of Phase 2.
//
//   AsyncStorage  →  SQLite  →  (metadata.json is created by SyncManager
//                                on first successful sync in Sprint 3)
//
// Guarded by a persisted flag `safevault.migration.v2.completed` — this
// module MUST be idempotent. Calling `runIfNeeded()` twice does nothing on
// the second call.
//
// The migration copies document metadata from the Phase-1 AsyncStorage store
// into the new SQLite database. It never mutates AsyncStorage — that remains
// the authoritative Phase-1 store until Sprint 3 wires VaultContext through
// SQLite. This keeps the sprint reversible: if we discover a bug we can
// simply clear the flag and re-run.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { VaultDocument, DocCategory } from '../types';
import { storage } from './storage';
import { sqlite, type SqliteDocument, type SqliteCategory } from './sqlite';
import { getDeviceId, getAppVersion } from './device';

const MIGRATION_FLAG = 'safevault.migration.v2.completed';

export interface MigrationResult {
  ranMigration: boolean;
  migratedDocs: number;
  migratedCategories: number;
  skippedReason?: 'already-done' | 'unsupported-platform' | 'empty-source';
  errors: string[];
}

/**
 * Read the flag. Returns true if migration has already completed on this device.
 */
export async function isMigrationCompleted(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(MIGRATION_FLAG);
  return raw === 'true';
}

/**
 * Force-clear the flag. Used by tests and by a hypothetical "reset & re-migrate"
 * troubleshooting affordance. Never called from ordinary runtime paths.
 */
export async function _resetMigrationFlagForTests(): Promise<void> {
  await AsyncStorage.removeItem(MIGRATION_FLAG);
}

/**
 * Perform the migration if the flag is unset. Safe to call at every app start.
 *
 * On web (where SQLite is a no-op driver), we mark the flag as completed too so
 * we don't re-enter this branch on every boot — the on-Drive manifest will
 * remain the source of truth on that platform.
 */
export async function runIfNeeded(): Promise<MigrationResult> {
  const result: MigrationResult = { ranMigration: false, migratedDocs: 0, migratedCategories: 0, errors: [] };

  if (await isMigrationCompleted()) {
    result.skippedReason = 'already-done';
    return result;
  }

  // Even on unsupported platforms, mark done so we don't retry every boot.
  const sqliteReady = await sqlite.isReady();
  if (!sqliteReady) {
    await AsyncStorage.setItem(MIGRATION_FLAG, 'true');
    result.skippedReason = 'unsupported-platform';
    return result;
  }

  try {
    await sqlite.init();

    const legacyDocs: VaultDocument[] = await storage.getDocs();
    const [deviceId, appVersion] = await Promise.all([getDeviceId(), Promise.resolve(getAppVersion())]);
    const now = new Date().toISOString();

    // Stamp manifest metadata so SyncManager can bootstrap without a null revision.
    await sqlite.setMeta({
      schemaVersion: 1,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      deviceId,
      appVersion,
    });

    // Migrate documents.
    for (const d of legacyDocs) {
      try {
        const row: SqliteDocument = {
          id: d.id,
          name: d.name,
          category: d.category,
          ownerId: d.ownerId,
          fileId: d.fileId ?? null,
          driveFolderId: null,           // filled by SyncManager on first push (Sprint 3)
          localUri: d.localUri ?? null,
          mimeType: d.mimeType ?? null,
          size: d.size ?? null,
          fileHash: d.fileHash ?? null,
          version: 1,
          issueDate: d.issueDate ?? null,
          expiryDate: d.expiryDate ?? null,
          notes: d.notes ?? null,
          reminder: d.reminder,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        };
        await sqlite.upsertDocument(row);
        result.migratedDocs++;
      } catch (e: any) {
        result.errors.push(`doc ${d.id}: ${e?.message || 'unknown'}`);
      }
    }

    // Migrate categories — derived from documents. Only categories actually
    // in use get recorded, so we honour "create category folders only when
    // first used" from Sprint 1.
    const seen = new Set<DocCategory>();
    for (const d of legacyDocs) {
      if (seen.has(d.category)) continue;
      seen.add(d.category);
      const row: SqliteCategory = {
        name: d.category,
        driveFolderId: null, // filled lazily by FolderManager on first upload
        createdAt: now,
      };
      try {
        await sqlite.upsertCategory(row);
        result.migratedCategories++;
      } catch (e: any) {
        result.errors.push(`category ${d.category}: ${e?.message || 'unknown'}`);
      }
    }

    // Even when legacyDocs is empty we still mark migration done.
    if (legacyDocs.length === 0) result.skippedReason = 'empty-source';

    result.ranMigration = true;
    await AsyncStorage.setItem(MIGRATION_FLAG, 'true');
  } catch (e: any) {
    result.errors.push('fatal: ' + (e?.message || 'unknown'));
    // Do NOT set the flag on fatal failure — allow a subsequent boot to retry.
  }

  return result;
}

/**
 * Diagnostic snapshot for tests / support tooling. Non-mutating.
 */
export async function status(): Promise<{
  flag: boolean;
  sqliteReady: boolean;
  platform: string;
  legacyDocCount: number;
  sqliteDocCount: number;
}> {
  const [flag, ready, legacy] = await Promise.all([
    isMigrationCompleted(),
    sqlite.isReady(),
    storage.getDocs(),
  ]);
  const count = ready ? await sqlite.countDocuments() : 0;
  return {
    flag,
    sqliteReady: ready,
    platform: Platform.OS,
    legacyDocCount: legacy.length,
    sqliteDocCount: count,
  };
}

export const Migration = {
  runIfNeeded,
  isMigrationCompleted,
  status,
  _resetMigrationFlagForTests,
  MIGRATION_FLAG,
};
