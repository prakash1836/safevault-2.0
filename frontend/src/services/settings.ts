// Settings — Storage & Security toggles + Sync status.
// Persisted in AsyncStorage; no schema change to SQLite.
// Biometric / auto-lock / recovery-kit / emergency-recovery are placeholders
// that persist their state today and will be wired up in a future sprint.

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SettingsState {
  autoSync: boolean;               // future — surfaced today
  syncOnlyOnWifi: boolean;         // future — surfaced today
  biometricUnlock: boolean;        // placeholder — persists
  autoLock: 'off' | '1m' | '5m' | '15m' | '1h'; // placeholder — persists
  encryptSensitive: boolean;       // reflects current default (true)
  lastSyncedAt: string | null;     // ISO. Updated by VaultContext on successful drive sync.
}

const KEY = 'safevault.settings.v1';

export const DEFAULT_SETTINGS: SettingsState = {
  autoSync: true,
  syncOnlyOnWifi: false,
  biometricUnlock: false,
  autoLock: 'off',
  encryptSensitive: true,
  lastSyncedAt: null,
};

export async function getSettings(): Promise<SettingsState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function updateSettings(patch: Partial<SettingsState>): Promise<SettingsState> {
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function markSyncedNow(): Promise<void> {
  await updateSettings({ lastSyncedAt: new Date().toISOString() });
}

export const Settings = {
  DEFAULT_SETTINGS,
  get: getSettings,
  update: updateSettings,
  markSyncedNow,
};
