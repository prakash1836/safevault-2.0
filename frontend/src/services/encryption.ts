import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEY_NAME = 'safevault.enc.key.v1';
const SALT_NAME = 'safevault.device.salt.v1';

async function getOrCreateSalt(): Promise<string> {
  let salt = await SecureStore.getItemAsync(SALT_NAME);
  if (!salt) {
    const bytes = await Crypto.getRandomBytesAsync(16);
    salt = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await SecureStore.setItemAsync(SALT_NAME, salt);
  }
  return salt;
}

// Derive AES-256 key from user ID + device salt (PBKDF2)
export async function deriveAndStoreKey(userId: string): Promise<string> {
  const salt = await getOrCreateSalt();
  const key = CryptoJS.PBKDF2(userId, salt, {
    keySize: 256 / 32,
    iterations: 10000,
  }).toString(CryptoJS.enc.Hex);
  await SecureStore.setItemAsync(KEY_NAME, key);
  return key;
}

export async function getKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEY_NAME);
}

export async function clearKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_NAME);
}

// Encrypt base64 string -> ciphertext string
export function encryptBase64(base64: string, keyHex: string): string {
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.lib.WordArray.random(16);
  const wordArray = CryptoJS.enc.Base64.parse(base64);
  const encrypted = CryptoJS.AES.encrypt(wordArray, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  // Store IV + ciphertext together
  return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.toString();
}

export function decryptToBase64(payload: string, keyHex: string): string {
  const [ivHex, ct] = payload.split(':');
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const decrypted = CryptoJS.AES.decrypt(ct, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
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
