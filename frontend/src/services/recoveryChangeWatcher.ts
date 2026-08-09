// Cross-device recovery-password-change detection.
//
// Each device caches the last envelope revision it "acknowledged" — either
// after a local setup, change, or successful restore. Whenever the app opens,
// we poll Drive for the current envelope revision. If Drive is newer, the
// user is warned that another device changed the recovery password and is
// prompted to re-verify.
//
// Storage: AsyncStorage (not sensitive). Per-vault key so switching accounts
// doesn't cross-contaminate.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'safevault.recovery.lastSeen.v1.';

export interface LastSeenState {
  vaultId: string;
  revision: number;
  updatedAt: string;
  seenAt: string;
}

function keyFor(vaultId: string): string { return KEY_PREFIX + vaultId; }

export async function getLastSeen(vaultId: string): Promise<LastSeenState | null> {
  const raw = await AsyncStorage.getItem(keyFor(vaultId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as LastSeenState;
  } catch { return null; }
}

export async function acknowledgeRevision(input: {
  vaultId: string;
  revision: number;
  updatedAt: string;
}): Promise<void> {
  const state: LastSeenState = {
    vaultId: input.vaultId,
    revision: input.revision,
    updatedAt: input.updatedAt,
    seenAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(keyFor(input.vaultId), JSON.stringify(state));
}

export interface ChangeCheck {
  changed: boolean;
  lastSeen: LastSeenState | null;
  current: { revision: number; updatedAt: string } | null;
}

/**
 * Compare the current envelope revision on Drive with what this device
 * last acknowledged.
 *   • no last-seen  → not "changed" (this is the first time we look).
 *   • Drive revision > last-seen revision → changed = true.
 *   • Drive revision === last-seen but updatedAt differs → changed = true
 *     (defensive: covers manual edits that don't bump revision).
 */
export function isChanged(
  lastSeen: LastSeenState | null,
  current: { revision: number; updatedAt: string } | null,
): boolean {
  if (!current) return false;
  if (!lastSeen) return false;
  if (current.revision > lastSeen.revision) return true;
  if (current.revision === lastSeen.revision && current.updatedAt !== lastSeen.updatedAt) return true;
  return false;
}

export async function clear(vaultId: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(vaultId));
}

export const RecoveryChangeWatcher = {
  getLastSeen,
  acknowledgeRevision,
  isChanged,
  clear,
};
