// Recovery Password (UX-only in this sprint).
//
// The user-facing "Recovery Password" collected during onboarding.
// Sprint scope: STORE only.  We DO NOT re-key the vault yet — the AES key
// derivation in services/encryption.ts is unchanged. This module simply
// remembers a bcrypt-style hash so we can verify the password later
// (e.g. Change Password, Emergency Recovery gate).
//
// FUTURE-PROOF INTERFACE
// ----------------------
// A future Recovery Sprint will call `deriveWrappingKey(password)` from
// here to produce a KEK that wraps the DEK. The public shape below is
// designed so that only the internals of THIS file need to change; the
// UI, upload flow and encryption module all stay the same.
//
// Storage: SecureStore on native, AsyncStorage on web (via the same
// `secureStore` shim exported by services/encryption.ts).

import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';
import { secureStore } from './encryption';

const HASH_KEY = 'safevault.recovery.hash.v1';
const SALT_KEY = 'safevault.recovery.salt.v1';
const SET_FLAG = 'safevault.recovery.set.v1';

/** Minimum length enforced by the UI + this module. */
export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordStrength {
  /** 0..4 — 0 = very weak, 4 = strong. */
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  hints: string[];
}

/** Cheap client-side strength evaluator (no zxcvbn dep). */
export function evaluatePasswordStrength(pw: string): PasswordStrength {
  const hints: string[] = [];
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return { score: 0, label: 'Too short', hints: [`Use at least ${MIN_PASSWORD_LENGTH} characters`] };
  }
  let score = 0;
  if (/[a-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;

  if (!/[A-Z]/.test(pw)) hints.push('Add an uppercase letter');
  if (!/[0-9]/.test(pw)) hints.push('Add a number');
  if (!/[^A-Za-z0-9]/.test(pw)) hints.push('Add a symbol');
  if (pw.length < 12) hints.push('Longer is stronger (12+ recommended)');

  const label = (['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const)[clamped];
  return { score: clamped, label, hints };
}

async function getOrCreateSalt(): Promise<string> {
  let salt = await secureStore.get(SALT_KEY);
  if (!salt) {
    const bytes = await Crypto.getRandomBytesAsync(16);
    salt = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    await secureStore.set(SALT_KEY, salt);
  }
  return salt;
}

function hashWithSalt(password: string, saltHex: string): string {
  // PBKDF2 with a healthy iteration count. Deliberately independent of the
  // AES key derivation in services/encryption.ts — the hash lives on-device
  // only and is never used to derive a decryption key in this sprint.
  return CryptoJS.PBKDF2(password, saltHex, { keySize: 256 / 32, iterations: 100000 }).toString(CryptoJS.enc.Hex);
}

/**
 * Persist the recovery password securely. The password itself is NEVER stored,
 * only a PBKDF2 hash + per-device salt.
 */
export async function setRecoveryPassword(password: string): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Recovery password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const salt = await getOrCreateSalt();
  const hash = hashWithSalt(password, salt);
  await secureStore.set(HASH_KEY, hash);
  await secureStore.set(SET_FLAG, '1');
}

/** Returns true when the user has previously set a recovery password on this device. */
export async function hasRecoveryPassword(): Promise<boolean> {
  const flag = await secureStore.get(SET_FLAG);
  return flag === '1';
}

/** Verify the supplied password matches the stored hash. */
export async function verifyRecoveryPassword(password: string): Promise<boolean> {
  const stored = await secureStore.get(HASH_KEY);
  if (!stored) return false;
  const salt = await getOrCreateSalt();
  const candidate = hashWithSalt(password, salt);
  return candidate === stored;
}

/**
 * Change the recovery password. In this sprint this is a straight replace of
 * the stored hash. A future recovery sprint will re-wrap the DEK inside this
 * function without changing its signature.
 */
export async function changeRecoveryPassword(current: string, next: string): Promise<void> {
  const ok = await verifyRecoveryPassword(current);
  if (!ok) throw new Error('Current password is incorrect');
  await setRecoveryPassword(next);
}

/**
 * FUTURE HOOK — placeholder. When the Recovery Sprint lands, THIS function
 * will return a KEK derived from the password to wrap the DEK. Any UI that
 * needs to plug into that flow can already await this signature; it currently
 * throws so mis-use is caught in dev.
 */
export async function deriveWrappingKey(_password: string): Promise<string> {
  throw new Error('deriveWrappingKey is not yet implemented — planned for the Recovery Sprint');
}

/** Wipe recovery-password material. Used on logout / factory reset. */
export async function clearRecoveryPassword(): Promise<void> {
  await secureStore.del(HASH_KEY);
  await secureStore.del(SALT_KEY);
  await secureStore.del(SET_FLAG);
}

export const RecoveryPassword = {
  MIN_PASSWORD_LENGTH,
  evaluatePasswordStrength,
  set: setRecoveryPassword,
  has: hasRecoveryPassword,
  verify: verifyRecoveryPassword,
  change: changeRecoveryPassword,
  deriveWrappingKey,
  clear: clearRecoveryPassword,
};
