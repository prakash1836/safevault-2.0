import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_NAME = 'safevault.enc.key.v1';
const SALT_NAME = 'safevault.device.salt.v1';

// Encryption format version.
// v1 (legacy): "ivHex:ciphertext"            — AES-256-CBC, no authentication
// v2 (current): "v2:ivHex:hmacHex:ciphertext" — AES-256-CBC + HMAC-SHA256 (Encrypt-then-MAC)
const ENC_VERSION = 'v2';

// Platform-aware secure storage. Native uses OS keychain via SecureStore; web falls back to AsyncStorage.
export const secureStore = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return AsyncStorage.getItem(key);
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
    try { await SecureStore.setItemAsync(key, value); } catch { await AsyncStorage.setItem(key, value); }
  },
  async del(key: string): Promise<void> {
    if (Platform.OS === 'web') { await AsyncStorage.removeItem(key); return; }
    try { await SecureStore.deleteItemAsync(key); } catch { await AsyncStorage.removeItem(key); }
  },
};

async function getOrCreateSalt(): Promise<string> {
  let salt = await secureStore.get(SALT_NAME);
  if (!salt) {
    const bytes = await Crypto.getRandomBytesAsync(16);
    salt = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    await secureStore.set(SALT_NAME, salt);
  }
  return salt;
}

export async function deriveAndStoreKey(userId: string): Promise<string> {
  const salt = await getOrCreateSalt();
  const key = CryptoJS.PBKDF2(userId, salt, { keySize: 256 / 32, iterations: 10000 }).toString(CryptoJS.enc.Hex);
  await secureStore.set(KEY_NAME, key);
  return key;
}

export async function getKey(): Promise<string | null> { return await secureStore.get(KEY_NAME); }
export async function clearKey(): Promise<void> { await secureStore.del(KEY_NAME); }

/** Derive an HMAC key from the AES key using SHA-256 with a domain-separation label. */
function deriveHmacKey(keyHex: string): CryptoJS.lib.WordArray {
  const aesKey = CryptoJS.enc.Hex.parse(keyHex);
  // HMAC key = SHA-256(aesKey || "safevault-hmac-v2") — domain-separated derivation
  const label = CryptoJS.enc.Utf8.parse('safevault-hmac-v2');
  const combined = aesKey.clone().concat(label);
  return CryptoJS.SHA256(combined);
}

/**
 * Encrypt a base64-encoded payload using AES-256-CBC + HMAC-SHA256 (Encrypt-then-MAC).
 * Provides authenticated encryption equivalent to AES-GCM.
 * Output format: "v2:ivHex:hmacHex:ciphertext"
 */
export function encryptBase64(base64: string, keyHex: string): string {
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.lib.WordArray.random(16);
  const wordArray = CryptoJS.enc.Base64.parse(base64);
  const encrypted = CryptoJS.AES.encrypt(wordArray, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  const ivHex = iv.toString(CryptoJS.enc.Hex);
  const ct = encrypted.toString();
  // HMAC covers iv + ciphertext to prevent IV tampering
  const hmacKey = deriveHmacKey(keyHex);
  const hmac = CryptoJS.HmacSHA256(ivHex + ':' + ct, hmacKey).toString(CryptoJS.enc.Hex);
  return `${ENC_VERSION}:${ivHex}:${hmac}:${ct}`;
}

/**
 * Decrypt a payload. Supports both v2 (authenticated) and v1 (legacy CBC) formats.
 * Throws on integrity failure for v2 payloads.
 */
export function decryptToBase64(payload: string, keyHex: string): string {
  // Detect format: v2 starts with "v2:", legacy is just "ivHex:ciphertext"
  if (payload.startsWith(`${ENC_VERSION}:`)) {
    const parts = payload.split(':');
    if (parts.length < 4) throw new Error('Malformed encrypted payload');
    const ivHex = parts[1];
    const hmac = parts[2];
    const ct = parts.slice(3).join(':');
    // Verify HMAC FIRST to prevent decryption-oracle attacks
    const hmacKey = deriveHmacKey(keyHex);
    const expected = CryptoJS.HmacSHA256(ivHex + ':' + ct, hmacKey).toString(CryptoJS.enc.Hex);
    if (expected !== hmac) {
      throw new Error('Integrity check failed — file may have been tampered with');
    }
    const key = CryptoJS.enc.Hex.parse(keyHex);
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(ct, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
    return decrypted.toString(CryptoJS.enc.Base64);
  }
  // Legacy v1 format — decrypt without HMAC (backward compatibility)
  const [ivHex, ct] = payload.split(':');
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const decrypted = CryptoJS.AES.decrypt(ct, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return decrypted.toString(CryptoJS.enc.Base64);
}

export function encryptJSON(obj: any, keyHex: string): string {
  const json = JSON.stringify(obj);
  const b64 = CryptoJS.enc.Utf8.parse(json).toString(CryptoJS.enc.Base64);
  return encryptBase64(b64, keyHex);
}

export function decryptJSON<T = any>(payload: string, keyHex: string): T {
  const b64 = decryptToBase64(payload, keyHex);
  const json = CryptoJS.enc.Base64.parse(b64).toString(CryptoJS.enc.Utf8);
  return JSON.parse(json) as T;
}

/** Check if a payload uses the current v2 (authenticated) format. */
export function isAuthenticatedFormat(payload: string): boolean {
  return payload.startsWith(`${ENC_VERSION}:`);
}
