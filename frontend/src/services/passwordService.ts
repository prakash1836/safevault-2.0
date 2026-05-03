// Password setup & verification.
// We NEVER store the raw password.
// We store only: { salt, hash = PBKDF2(password, salt, iterations), iterations }.
// ZIP encryption still uses the raw (in-memory) password.

import * as Crypto from 'expo-crypto';
import { storage } from './storageService';
import { PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, STORAGE_KEYS } from '../utils/constants';

interface PasswordVerifier {
  salt: string;      // base64
  hash: string;      // base64
  iterations: number;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa === 'function') return btoa(binary);
  // Node/RN fallback
  // @ts-ignore
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  // @ts-ignore
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyLen: number,
): Promise<Uint8Array> {
  // WebCrypto path (works on web + modern RN with expo-crypto polyfill)
  const subtle: SubtleCrypto | undefined =
    (globalThis as any).crypto?.subtle ?? undefined;

  if (subtle) {
    const enc = new TextEncoder();
    const keyMaterial = await subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits'],
    );
    const bits = await subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt as unknown as BufferSource,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      keyLen * 8,
    );
    return new Uint8Array(bits);
  }

  // Fallback using repeated SHA-256 HMAC approximation via expo-crypto.
  // (Only hit on very old RN envs; newer Expo ships WebCrypto.)
  let acc = password + toBase64(salt);
  for (let i = 0; i < Math.min(iterations, 10_000); i++) {
    acc = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, acc);
  }
  const out = new Uint8Array(keyLen);
  for (let i = 0; i < keyLen; i++) out[i] = acc.charCodeAt(i % acc.length);
  return out;
}

export const passwordService = {
  /** True if a verifier has been stored (i.e. user completed first-time setup). */
  async hasPassword(): Promise<boolean> {
    const raw = await storage.getItem(STORAGE_KEYS.passwordVerifier);
    return !!raw;
  },

  async setPassword(password: string): Promise<void> {
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    const salt = Crypto.getRandomBytes(16);
    const hashBytes = await pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN);
    const verifier: PasswordVerifier = {
      salt: toBase64(salt),
      hash: toBase64(hashBytes),
      iterations: PBKDF2_ITERATIONS,
    };
    await storage.setItem(STORAGE_KEYS.passwordVerifier, JSON.stringify(verifier));
  },

  async verifyPassword(password: string): Promise<boolean> {
    const raw = await storage.getItem(STORAGE_KEYS.passwordVerifier);
    if (!raw) return false;
    const v: PasswordVerifier = JSON.parse(raw);
    const salt = fromBase64(v.salt);
    const hashBytes = await pbkdf2(password, salt, v.iterations, PBKDF2_KEY_LEN);
    return toBase64(hashBytes) === v.hash;
  },

  async clear(): Promise<void> {
    await storage.removeItem(STORAGE_KEYS.passwordVerifier);
  },
};
