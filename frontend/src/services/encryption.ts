import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_NAME = 'safevault.enc.key.v1';
const SALT_NAME = 'safevault.device.salt.v1';

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

export async function encryptBase64(base64: string, keyHex: string): Promise<string> {
  const key = CryptoJS.enc.Hex.parse(keyHex);

  const randomBytes = await Crypto.getRandomBytesAsync(16);

  const iv = CryptoJS.lib.WordArray.create(
    Array.from(randomBytes)
  );

  const wordArray = CryptoJS.enc.Base64.parse(base64);

  const encrypted = CryptoJS.AES.encrypt(wordArray, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return iv.toString(CryptoJS.enc.Hex) + ":" + encrypted.toString();
}
export async function decryptToBase64(payload: string, keyHex: string): Promise<string> {
  const [ivHex, ct] = payload.split(':');
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const decrypted = CryptoJS.AES.decrypt(ct, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return decrypted.toString(CryptoJS.enc.Base64);
}

export async function encryptJSON(obj: any, keyHex: string): Promise<string> {
  const json = JSON.stringify(obj);
  const b64 = CryptoJS.enc.Utf8.parse(json).toString(CryptoJS.enc.Base64);
  return await encryptBase64(b64, keyHex);
}

export async function decryptJSON<T = any>(payload: string, keyHex: string): Promise<T> {
  const b64 = await decryptToBase64(payload, keyHex);
  const json = CryptoJS.enc.Base64.parse(b64).toString(CryptoJS.enc.Utf8);
  return JSON.parse(json) as T;
}
