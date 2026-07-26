// Device & app-version helpers. Small utility module — one deviceId per install,
// persisted in AsyncStorage under a stable key.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

const K_DEVICE_ID = 'safevault.device.id';
const K_APP_VERSION = 'safevault.app.version';

/**
 * Return a stable per-install device identifier. Created on first call and
 * persisted; subsequent calls always return the same value.
 */
export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(K_DEVICE_ID);
  if (id) return id;
  try {
    const bytes = await Crypto.getRandomBytesAsync(9);
    id = 'dev_' + Array.from(bytes).map((b) => b.toString(36)).join('').slice(0, 12);
  } catch {
    id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  await AsyncStorage.setItem(K_DEVICE_ID, id);
  return id;
}

/**
 * Read the last-known app version tag. Currently a static "0.2.0" — Sprint 2 baseline.
 * Kept as a helper so future builds can wire in expo-constants without touching callers.
 */
export function getAppVersion(): string {
  return '0.2.0';
}

/** Human-readable device name; best-effort. */
export function getDeviceName(): string {
  return Platform.OS === 'web' ? 'Web' : Platform.OS === 'ios' ? 'iOS' : 'Android';
}

/** Called on user logout to reset the stored device version tag (not the ID). */
export async function resetAppVersion(): Promise<void> {
  await AsyncStorage.removeItem(K_APP_VERSION);
}
