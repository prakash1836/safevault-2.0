// SafeVault Recovery Service.
//
// See /app/frontend/docs/RECOVERY.md for the design write-up. This file
// implements the KEK-wraps-DEK envelope described there.
//
// Guarantees:
//   * The device's DEK (safevault.enc.key.v1) is NEVER changed by this module.
//     Every operation just wraps or unwraps the existing hex string.
//   * The recovery password is NEVER persisted in plaintext.
//   * Wrong-password attempts NEVER touch the DEK, SecureStore or the Drive
//     envelope (they short-circuit at the verifier check).
//   * All operations are idempotent — a repeat call after an interrupted
//     run finds a consistent state and either no-ops or completes.

import CryptoJS from 'crypto-js';
import * as Crypto from 'expo-crypto';
import type { AuthUser } from '../types';
import { FolderManager } from './folderManager';
import {
  findFileOnDrive,
  downloadFromDrive,
  uploadToDrive,
  updateFileOnDrive,
} from './drive';
import { secureStore, getKey } from './encryption';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const RECOVERY_SCHEMA = 'safevault.recovery.v1';
export const RECOVERY_FILE_NAME = 'recovery.json';
export const RECOVERY_BACKUP_NAME = 'recovery.bak';
const RECOVERY_MIME = 'application/json';

/** PBKDF2 params. Higher iterations = safer against brute-force at the cost
 *  of a one-time ~1s hit on setup/restore. Fine because these are rare ops. */
export const KDF = {
  algorithm: 'PBKDF2-SHA256' as const,
  iterations: 210_000,
  saltBytes: 16,      // 128-bit salt
  outputBytes: 64,    // 32 bytes KEK + 32 bytes verifier
};

/** AES-256-CBC-PKCS7, per-envelope random 128-bit IV. */
export const WRAP_ALGO = 'AES-256-CBC' as const;

const DEK_STORE_KEY = 'safevault.enc.key.v1';
const RECOVERY_LOCAL_FLAG = 'safevault.recovery.setup.v1';

/* -------------------------------------------------------------------------- */
/* Envelope shape                                                             */
/* -------------------------------------------------------------------------- */

export interface RecoveryEnvelope {
  schema: typeof RECOVERY_SCHEMA;
  vaultId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  kdf: {
    algorithm: typeof KDF.algorithm;
    iterations: number;
    saltHex: string;
  };
  wrappedKey: {
    algorithm: typeof WRAP_ALGO;
    ivHex: string;
    ciphertext: string; // base64
  };
  /** Hex of the second half of the PBKDF2 output — used ONLY to detect
   *  wrong-password without ever calling AES. Reveals nothing about the KEK
   *  (independent PBKDF2 output half). */
  verifierHex: string;
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function nowIso(): string { return new Date().toISOString(); }

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function randomBytes(n: number): Promise<Uint8Array> {
  return Crypto.getRandomBytesAsync(n);
}

/**
 * Derive KEK + Verifier from the recovery password.
 * Returns hex strings so they can be compared and re-used easily.
 * Deterministic given (password, saltHex, iterations).
 */
export function deriveKekAndVerifier(
  password: string,
  saltHex: string,
  iterations: number = KDF.iterations,
): { kekHex: string; verifierHex: string } {
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const derived = CryptoJS.PBKDF2(password, salt, {
    keySize: KDF.outputBytes / 4, // crypto-js keySize is in 32-bit words → 16 words = 64 bytes
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
  const fullHex = derived.toString(CryptoJS.enc.Hex); // 128 hex chars = 64 bytes
  return {
    kekHex: fullHex.slice(0, 64),        // bytes 0..32 → KEK
    verifierHex: fullHex.slice(64, 128), // bytes 32..64 → verifier
  };
}

/**
 * Wrap the DEK (a hex string) with the KEK using AES-256-CBC + random IV.
 * Returns the envelope's `wrappedKey` object.
 */
export function wrapDek(dekHex: string, kekHex: string, ivHex?: string): { ivHex: string; ciphertext: string } {
  const iv = ivHex
    ? CryptoJS.enc.Hex.parse(ivHex)
    : CryptoJS.lib.WordArray.random(16);
  const kek = CryptoJS.enc.Hex.parse(kekHex);
  // Encrypt the DEK's 32 raw bytes (parsed from its hex representation).
  const dekBytes = CryptoJS.enc.Hex.parse(dekHex);
  const enc = CryptoJS.AES.encrypt(dekBytes, kek, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    ivHex: iv.toString(CryptoJS.enc.Hex),
    ciphertext: enc.toString(), // base64
  };
}

/**
 * Unwrap the DEK using the KEK. Returns the original DEK hex string.
 * Throws on padding failure (wrong password / corrupted ciphertext).
 */
export function unwrapDek(
  wrapped: { ivHex: string; ciphertext: string },
  kekHex: string,
): string {
  const kek = CryptoJS.enc.Hex.parse(kekHex);
  const iv = CryptoJS.enc.Hex.parse(wrapped.ivHex);
  const dec = CryptoJS.AES.decrypt(wrapped.ciphertext, kek, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const hex = dec.toString(CryptoJS.enc.Hex);
  if (!hex || hex.length !== 64) {
    throw new Error('Unwrapped DEK is not 32 bytes — wrong key or corrupted ciphertext');
  }
  return hex;
}

/* -------------------------------------------------------------------------- */
/* Envelope construction + validation                                         */
/* -------------------------------------------------------------------------- */

/** Best-effort structural validation. Returns an array of errors (empty = ok). */
export function validateEnvelope(e: any): string[] {
  const errs: string[] = [];
  if (!e || typeof e !== 'object') return ['envelope is not an object'];
  if (e.schema !== RECOVERY_SCHEMA) errs.push(`schema must be ${RECOVERY_SCHEMA}`);
  if (typeof e.vaultId !== 'string' || !e.vaultId) errs.push('vaultId missing');
  if (typeof e.revision !== 'number') errs.push('revision must be a number');
  if (!e.kdf || e.kdf.algorithm !== KDF.algorithm) errs.push('kdf.algorithm mismatch');
  if (!e.kdf || typeof e.kdf.iterations !== 'number' || e.kdf.iterations < 10_000) errs.push('kdf.iterations invalid');
  if (!e.kdf || typeof e.kdf.saltHex !== 'string' || e.kdf.saltHex.length < 16) errs.push('kdf.saltHex invalid');
  if (!e.wrappedKey || e.wrappedKey.algorithm !== WRAP_ALGO) errs.push('wrappedKey.algorithm mismatch');
  if (!e.wrappedKey || typeof e.wrappedKey.ivHex !== 'string' || e.wrappedKey.ivHex.length !== 32) errs.push('wrappedKey.ivHex invalid');
  if (!e.wrappedKey || typeof e.wrappedKey.ciphertext !== 'string' || !e.wrappedKey.ciphertext) errs.push('wrappedKey.ciphertext invalid');
  if (typeof e.verifierHex !== 'string' || e.verifierHex.length !== 64) errs.push('verifierHex invalid');
  return errs;
}

/** Build a brand-new envelope wrapping `dekHex` with `password`. */
export async function buildEnvelope(input: {
  dekHex: string;
  password: string;
  vaultId: string;
  previousRevision?: number;
}): Promise<RecoveryEnvelope> {
  const saltBytes = await randomBytes(KDF.saltBytes);
  const saltHex = bytesToHex(saltBytes);
  const { kekHex, verifierHex } = deriveKekAndVerifier(input.password, saltHex);
  const wrapped = wrapDek(input.dekHex, kekHex);
  const t = nowIso();
  return {
    schema: RECOVERY_SCHEMA,
    vaultId: input.vaultId,
    revision: (input.previousRevision || 0) + 1,
    createdAt: t,
    updatedAt: t,
    kdf: { algorithm: KDF.algorithm, iterations: KDF.iterations, saltHex },
    wrappedKey: { algorithm: WRAP_ALGO, ...wrapped },
    verifierHex,
  };
}

export type PasswordCheck =
  | { ok: true; kekHex: string; envelope: RecoveryEnvelope }
  | { ok: false; reason: 'wrong-password' | 'malformed' };

/**
 * Verify the password against an envelope WITHOUT unwrapping.
 * O(1) after the PBKDF2 derivation — no AES call, no side effects.
 */
export function checkPassword(envelope: RecoveryEnvelope, password: string): PasswordCheck {
  const errs = validateEnvelope(envelope);
  if (errs.length) return { ok: false, reason: 'malformed' };
  const { kekHex, verifierHex } = deriveKekAndVerifier(
    password,
    envelope.kdf.saltHex,
    envelope.kdf.iterations,
  );
  if (verifierHex !== envelope.verifierHex) return { ok: false, reason: 'wrong-password' };
  return { ok: true, kekHex, envelope };
}

/* -------------------------------------------------------------------------- */
/* Drive I/O                                                                  */
/* -------------------------------------------------------------------------- */

/** Encode the envelope for upload. Plaintext JSON — the sensitive part is
 *  already encrypted inside. Storing it un-encrypted-by-the-DEK is intentional:
 *  a new device has no DEK yet, so it MUST be able to read the envelope. */
function encodeEnvelope(env: RecoveryEnvelope): string {
  return JSON.stringify(env);
}

function decodeEnvelope(payload: string): RecoveryEnvelope {
  const parsed = JSON.parse(payload);
  const errs = validateEnvelope(parsed);
  if (errs.length) {
    const e = new Error('Recovery envelope failed validation: ' + errs.join('; '));
    (e as any).code = 'RecoveryEnvelopeCorruptedError';
    throw e;
  }
  return parsed as RecoveryEnvelope;
}

async function findEnvelope(user: AuthUser, name: string): Promise<{ id: string; appProperties?: Record<string, string> } | null> {
  const manifestFolderId = await FolderManager.ensureSubfolder(user, 'manifest');
  return findFileOnDrive(user, {
    name,
    parentId: manifestFolderId,
    onlyFolders: false,
    appProperties: { 'safevault': '1', 'safevault.role': 'recovery' },
  });
}

/**
 * Locate + download the recovery envelope from Drive.
 * Falls back to `recovery.bak` if the primary is corrupted.
 * Returns `null` when no envelope exists on the account.
 */
export async function fetchEnvelope(user: AuthUser): Promise<
  | { envelope: RecoveryEnvelope; fileId: string; recovered: boolean }
  | null
> {
  const [primary, backup] = await Promise.all([
    findEnvelope(user, RECOVERY_FILE_NAME),
    findEnvelope(user, RECOVERY_BACKUP_NAME),
  ]);

  if (primary) {
    try {
      const payload = await downloadFromDrive(user, primary.id);
      const env = decodeEnvelope(payload);
      return { envelope: env, fileId: primary.id, recovered: false };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[recovery] primary envelope failed, trying backup:', (e as Error).message);
    }
  }
  if (backup) {
    try {
      const payload = await downloadFromDrive(user, backup.id);
      const env = decodeEnvelope(payload);
      return { envelope: env, fileId: backup.id, recovered: true };
    } catch (e) {
      const err = new Error('Recovery envelope + backup both corrupted');
      (err as any).code = 'RecoveryEnvelopeCorruptedError';
      throw err;
    }
  }
  return null;
}

/**
 * Upload / update the envelope. Rotates the previous primary into `recovery.bak`
 * on every save (mirrors MetadataManager's approach).
 */
export async function saveEnvelope(user: AuthUser, env: RecoveryEnvelope): Promise<{ fileId: string }> {
  const manifestFolderId = await FolderManager.ensureSubfolder(user, 'manifest');
  const errs = validateEnvelope(env);
  if (errs.length) throw new Error('Refusing to save invalid envelope: ' + errs.join('; '));
  const payload = encodeEnvelope(env);
  const tags = {
    'safevault': '1',
    'safevault.role': 'recovery',
    'safevault.schema': env.schema,
    'safevault.revision': String(env.revision),
    'safevault.updatedAt': env.updatedAt,
  };

  // Rotate primary → backup before overwriting primary
  const existingPrimary = await findEnvelope(user, RECOVERY_FILE_NAME);
  if (existingPrimary) {
    try {
      const prev = await downloadFromDrive(user, existingPrimary.id);
      const bakTags = { ...tags, 'safevault.backupOf': RECOVERY_FILE_NAME };
      const existingBackup = await findEnvelope(user, RECOVERY_BACKUP_NAME);
      if (existingBackup) {
        await updateFileOnDrive(user, existingBackup.id, { body: prev, mimeType: RECOVERY_MIME, appProperties: bakTags });
      } else {
        await uploadToDrive(user, RECOVERY_BACKUP_NAME, prev, RECOVERY_MIME, { parentId: manifestFolderId, appProperties: bakTags });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[recovery] backup rotation failed:', (e as Error).message);
    }
  }

  if (existingPrimary) {
    const updated = await updateFileOnDrive(user, existingPrimary.id, { body: payload, mimeType: RECOVERY_MIME, appProperties: tags });
    return { fileId: updated.id };
  }
  const fileId = await uploadToDrive(user, RECOVERY_FILE_NAME, payload, RECOVERY_MIME, {
    parentId: manifestFolderId,
    appProperties: tags,
  });
  return { fileId };
}

/* -------------------------------------------------------------------------- */
/* High-level flows                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Set up recovery for the CURRENT device.
 *   • Idempotent: if the envelope already exists AND the password unlocks it AND
 *     the unwrapped DEK matches this device's DEK, we return { alreadySetUp: true }.
 *   • Non-destructive on error: never overwrites an existing envelope with a
 *     mis-derived one — we always verify by round-tripping through unwrap.
 */
export async function setupRecovery(input: {
  user: AuthUser;
  password: string;
}): Promise<{ setUp: true; alreadySetUp: boolean; fileId: string }> {
  const { user, password } = input;
  const dekHex = await getKey();
  if (!dekHex) throw new Error('No encryption key on this device — cannot set up recovery yet');

  const existing = await fetchEnvelope(user);
  if (existing) {
    // Idempotent: verify the same password unwraps to the SAME DEK.
    const check = checkPassword(existing.envelope, password);
    if (check.ok) {
      try {
        const unwrapped = unwrapDek(existing.envelope.wrappedKey, check.kekHex);
        if (unwrapped === dekHex) {
          await secureStore.set(RECOVERY_LOCAL_FLAG, '1');
          return { setUp: true, alreadySetUp: true, fileId: existing.fileId };
        }
      } catch { /* fall through and re-wrap */ }
    }
    // Password differs OR wraps a different DEK than the one on this device.
    // This can happen if the user changed the password on another device.
    // We refuse to silently overwrite; require the caller to route to change-password.
    const e = new Error('An existing recovery envelope was found for a different password/DEK. Use Change Recovery Password to re-wrap.');
    (e as any).code = 'RecoveryEnvelopeConflictError';
    throw e;
  }

  const vaultId = 'sv_' + (user.id || 'anon');
  const env = await buildEnvelope({ dekHex, password, vaultId });
  const saved = await saveEnvelope(user, env);
  await secureStore.set(RECOVERY_LOCAL_FLAG, '1');
  return { setUp: true, alreadySetUp: false, fileId: saved.fileId };
}

export type RestoreResult =
  | { ok: true; dekHex: string; envelope: RecoveryEnvelope; recovered: boolean }
  | { ok: false; reason: 'no-envelope' | 'wrong-password' | 'malformed' | 'corrupted' | 'no-drive' };

/**
 * Restore the vault on a NEW device (or after uninstall).
 *   • Never touches the local DEK unless the password successfully unwraps.
 *   • Wrong password: verifier mismatch → returns `wrong-password`. No I/O.
 */
export async function restoreVault(input: {
  user: AuthUser;
  password: string;
  /** When true, writes the unwrapped DEK to SecureStore under the standard key. */
  commit?: boolean;
}): Promise<RestoreResult> {
  const { user, password, commit = true } = input;
  let fetched;
  try {
    fetched = await fetchEnvelope(user);
  } catch (e: any) {
    if (e?.code === 'RecoveryEnvelopeCorruptedError') return { ok: false, reason: 'corrupted' };
    return { ok: false, reason: 'no-drive' };
  }
  if (!fetched) return { ok: false, reason: 'no-envelope' };

  const check = checkPassword(fetched.envelope, password);
  if (!check.ok) return { ok: false, reason: check.reason };

  let dekHex: string;
  try {
    dekHex = unwrapDek(fetched.envelope.wrappedKey, check.kekHex);
  } catch {
    // The verifier matched but AES failed → envelope tampered.
    return { ok: false, reason: 'corrupted' };
  }

  if (commit) {
    await secureStore.set(DEK_STORE_KEY, dekHex);
    await secureStore.set(RECOVERY_LOCAL_FLAG, '1');
  }
  return { ok: true, dekHex, envelope: fetched.envelope, recovered: fetched.recovered };
}

/**
 * Change the recovery password. Requires the CURRENT DEK to be present
 * on this device (either because setup happened here, or a previous
 * successful restore ran). We re-wrap the SAME DEK with a new KEK.
 */
export async function changeRecoveryPassword(input: {
  user: AuthUser;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true; fileId: string } | { ok: false; reason: 'wrong-password' | 'no-envelope' | 'no-dek' }> {
  const dekHex = await getKey();
  if (!dekHex) return { ok: false, reason: 'no-dek' };

  const existing = await fetchEnvelope(input.user);
  if (!existing) return { ok: false, reason: 'no-envelope' };

  const check = checkPassword(existing.envelope, input.currentPassword);
  if (!check.ok) return { ok: false, reason: 'wrong-password' };

  // Re-wrap the same DEK with a new KEK.
  const vaultId = existing.envelope.vaultId;
  const env = await buildEnvelope({
    dekHex,
    password: input.newPassword,
    vaultId,
    previousRevision: existing.envelope.revision,
  });
  const saved = await saveEnvelope(input.user, env);
  return { ok: true, fileId: saved.fileId };
}

/** Whether this device shows the "Recovery configured ✓" state. */
export async function isRecoveryConfiguredLocally(): Promise<boolean> {
  return (await secureStore.get(RECOVERY_LOCAL_FLAG)) === '1';
}

export async function markRecoveryConfiguredLocally(): Promise<void> {
  await secureStore.set(RECOVERY_LOCAL_FLAG, '1');
}

export async function clearLocalRecoveryFlag(): Promise<void> {
  await secureStore.del(RECOVERY_LOCAL_FLAG);
}

export const Recovery = {
  RECOVERY_SCHEMA,
  KDF,
  WRAP_ALGO,
  deriveKekAndVerifier,
  wrapDek,
  unwrapDek,
  validateEnvelope,
  buildEnvelope,
  checkPassword,
  fetchEnvelope,
  saveEnvelope,
  setupRecovery,
  restoreVault,
  changeRecoveryPassword,
  isRecoveryConfiguredLocally,
  markRecoveryConfiguredLocally,
  clearLocalRecoveryFlag,
};
