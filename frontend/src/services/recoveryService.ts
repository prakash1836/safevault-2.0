// Recovery service — fetches the user's vault purely from Google Drive, with
// a local cache for speed. No hard dependency on any index file.

import { driveService } from './driveService';
import { storage } from './storageService';
import { STORAGE_KEYS } from '../utils/constants';
import type { DriveFile, VaultEntry } from '../types';

function driveFileToEntry(f: DriveFile): VaultEntry {
  const name = f.appProperties?.originalName || f.name.replace(/\.zip$/i, '');
  return {
    driveFileId: f.id,
    name,
    zipName: f.name,
    originalMimeType: f.appProperties?.originalMimeType || undefined,
    sizeBytes: f.size ? parseInt(f.size, 10) : undefined,
    uploadedAt: f.modifiedTime || new Date().toISOString(),
  };
}

export const recoveryService = {
  /**
   * Load vault entries. Tries the cached list for instant UI, then refreshes
   * from Drive. Works even if the cache is missing (reinstall / new device).
   */
  async loadVault(
    accessToken: string,
    opts: { forceRefresh?: boolean } = {},
  ): Promise<{ entries: VaultEntry[]; fromCache: boolean }> {
    let cached: VaultEntry[] | null = null;
    if (!opts.forceRefresh) {
      const raw = await storage.getItem(STORAGE_KEYS.cachedIndex);
      if (raw) {
        try {
          cached = JSON.parse(raw) as VaultEntry[];
        } catch {
          cached = null;
        }
      }
    }

    try {
      let files = await driveService.listAppFiles(accessToken);
      // If no files found via the marker, try a broad ZIP listing as fallback
      // (covers the case where a user has legacy ZIPs from another device).
      if (files.length === 0) {
        const allZips = await driveService.listAllZips(accessToken);
        files = allZips;
      }
      const entries = files.map(driveFileToEntry);
      await storage.setItem(STORAGE_KEYS.cachedIndex, JSON.stringify(entries));
      return { entries, fromCache: false };
    } catch (e) {
      if (cached) return { entries: cached, fromCache: true };
      throw e;
    }
  },

  async clearCache(): Promise<void> {
    await storage.removeItem(STORAGE_KEYS.cachedIndex);
  },
};
