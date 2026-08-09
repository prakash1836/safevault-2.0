// Storage-mode preference — where new uploads land by default.
//
//   local  → saved only on-device (encrypted cache), never uploaded.
//   drive  → encrypted + uploaded to Google Drive, no local cache.
//   both   → encrypted + uploaded to Drive AND kept in the local cache. (Default.)
//
// UploadCoordinator branches on this value. The user can override the choice
// per document in the Upload Wizard's "Storage Type" step; whichever they pick
// last becomes the new default.

import AsyncStorage from '@react-native-async-storage/async-storage';

export type StorageMode = 'local' | 'drive' | 'both';

const K_MODE = 'safevault.storage.mode.v1';
const K_LOCAL_WARN = 'safevault.storage.local.warn.dismissed.v1';
const K_VAULT_NAME = 'safevault.vault.name.v1';
const K_DISPLAY_NAME = 'safevault.user.displayName.v1';

const DEFAULT_MODE: StorageMode = 'both';

export async function getStorageMode(): Promise<StorageMode> {
  const raw = await AsyncStorage.getItem(K_MODE);
  if (raw === 'local' || raw === 'drive' || raw === 'both') return raw;
  return DEFAULT_MODE;
}

export async function setStorageMode(mode: StorageMode): Promise<void> {
  await AsyncStorage.setItem(K_MODE, mode);
}

export async function isLocalOnlyWarningDismissed(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(K_LOCAL_WARN);
  return raw === '1';
}

export async function dismissLocalOnlyWarning(): Promise<void> {
  await AsyncStorage.setItem(K_LOCAL_WARN, '1');
}

export async function getVaultName(): Promise<string | null> {
  return AsyncStorage.getItem(K_VAULT_NAME);
}

export async function setVaultName(name: string | null): Promise<void> {
  if (!name) await AsyncStorage.removeItem(K_VAULT_NAME);
  else await AsyncStorage.setItem(K_VAULT_NAME, name);
}

export async function getDisplayName(): Promise<string | null> {
  return AsyncStorage.getItem(K_DISPLAY_NAME);
}

export async function setDisplayName(name: string | null): Promise<void> {
  if (!name) await AsyncStorage.removeItem(K_DISPLAY_NAME);
  else await AsyncStorage.setItem(K_DISPLAY_NAME, name);
}

export const StoragePreference = {
  DEFAULT_MODE,
  getMode: getStorageMode,
  setMode: setStorageMode,
  getVaultName,
  setVaultName,
  getDisplayName,
  setDisplayName,
  isLocalOnlyWarningDismissed,
  dismissLocalOnlyWarning,
};
