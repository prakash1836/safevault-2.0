// SafeVault Recovery Service — schema-v2 with authenticated integrity.
//
// See /app/frontend/docs/RECOVERY.md for the design write-up.
//
// Non-goals of this module (unchanged from v1):
//   * Never changes the device's DEK (safevault.enc.key.v1).
//   * Never persists the recovery password in plaintext.
//   * Wrong-password / tampered / rollback attempts have zero side-effects
//     on the DEK, SecureStore, or the Drive envelope.
//
// Schema v2 additions (this sprint):
//   * PBKDF2 output extended from 64 to 96 bytes: KEK(0..32) + Verifier(32..64)
//     + MAC_KEY(64..96). Because PBKDF2 is a stream KDF, the first 64 bytes
//     are BIT-IDENTICAL to the v1 derivation for the same password/salt/iters.
//     This is what makes v1→v2 migration deterministic.
//   * HMAC-SHA256 over a canonical MAC input covering every security-relevant
//     field. Constant-time verify. Rejects any envelope tampering.
//   * Rollback protection via a version-neutral SecureStore key holding the
//     highest revision this device has ever successfully accepted.
//
// Verification pipeline (invariant):
//     load → validate → derive PBKDF2 → verifier compare
//         → HMAC compute → constant-time HMAC compare
//         → AES-CBC unwrap → 32-byte DEK sanity check
//         → install into SecureStore
//   Any failure short-circuits WITHOUT touching the DEK.

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

export const RECOVERY_SCHEMA_V1 = 'safevault.recovery.v1' as const;
export const RECOVERY_SCHEMA_V2 = 'safevault.recovery.v2' as const;
export const RECOVERY_SCHEMA_CURRENT = RECOVERY_SCHEMA_V2;

/** Kept for backwards compatibility of the exported constant name. */
export const RECOVERY_SCHEMA = RECOVERY_SCHEMA_V2;

export const RECOVERY_FILE_NAME = 'recovery.json';
export const RECOVERY_BACKUP_NAME = 'recovery.bak';
const RECOVERY_MIME = 'application/json';

export const KDF_V1_OUTPUT_BYTES = 64;   // 32 KEK + 32 verifier
export const KDF_V2_OUTPUT_BYTES = 96;   // 32 KEK + 32 verifier + 32 MAC key

export const KDF = {
  algorithm: 'PBKDF2-SHA256' as const,
  iterations: 210_000,
  saltBytes: 16,
  outputBytes: KDF_V2_OUTPUT_BYTES,
};

export const WRAP_ALGO = 'AES-256-CBC' as const;
export const MAC_ALGO = 'HMAC-SHA256' as const;

const DEK_STORE_KEY = 'safevault.enc.key.v1';
const RECOVERY_LOCAL_FLAG = 'safevault.recovery.setup.v1';
/** Version-NEUTRAL storage key — protects against BOTH v1 and v2 rollbacks. */
const HIGHEST_REV_KEY_PREFIX = 'safevault.recovery.highest.revision.';

/* -------------------------------------------------------------------------- */
/* Envelope types                                                             */
/* -------------------------------------------------------------------------- */

export interface RecoveryEnvelopeV1 {
  schema: typeof RECOVERY_SCHEMA_V1;
  vaultId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  kdf: { algorithm: 'PBKDF2-SHA256'; iterations: number; saltHex: string };
  wrappedKey: { algorithm: 'AES-256-CBC'; ivHex: string; ciphertext: string };
  verifierHex: string;
}

export interface RecoveryEnvelopeV2 {
  schema: typeof RECOVERY_SCHEMA_V2;
  vaultId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  kdf: { algorithm: 'PBKDF2-SHA256'; iterations: number; saltHex: string; outputBytes: 96 };
  wrappedKey: { algorithm: 'AES-256-CBC'; ivHex: string; ciphertext: string };
  verifierHex: string;
  mac: { algorithm: 'HMAC-SHA256'; hex: string };
}

export type RecoveryEnvelope = RecoveryEnvelopeV1 | RecoveryEnvelopeV2;

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

/** Length-safe, constant-time hex comparison. Returns false if lengths differ. */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  return mismatch === 0;
}

/* -------------------------------------------------------------------------- */
/* KDF                                                                        */
/* -------------------------------------------------------------------------- */

/** Backwards-compat: returns just the first 64 bytes. Used for v1 envelopes. */
export function deriveKekAndVerifier(
  password: string,
  saltHex: string,
  iterations: number = KDF.iterations,
): { kekHex: string; verifierHex: string } {
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const derived = CryptoJS.PBKDF2(password, salt, {
    keySize: KDF_V1_OUTPUT_BYTES / 4,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
  const fullHex = derived.toString(CryptoJS.enc.Hex);
  return { kekHex: fullHex.slice(0, 64), verifierHex: fullHex.slice(64, 128) };
}

/**
 * v2 derivation: returns 96 bytes → KEK + Verifier + MAC_KEY.
 * The first 64 bytes are IDENTICAL to `deriveKekAndVerifier` for the same
 * password/salt/iterations. This is the mathematical guarantee behind the
 * deterministic v1 → v2 migration.
 */
export function deriveKekVerifierAndMac(
  password: string,
  saltHex: string,
  iterations: number = KDF.iterations,
  outputBytes: number = KDF_V2_OUTPUT_BYTES,
): { kekHex: string; verifierHex: string; macKeyHex: string } {
  if (outputBytes < KDF_V2_OUTPUT_BYTES) {
    throw new Error(`deriveKekVerifierAndMac requires ≥ ${KDF_V2_OUTPUT_BYTES} bytes`);
  }
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const derived = CryptoJS.PBKDF2(password, salt, {
    keySize: outputBytes / 4,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
  const fullHex = derived.toString(CryptoJS.enc.Hex);
  return {
    kekHex: fullHex.slice(0, 64),
    verifierHex: fullHex.slice(64, 128),
    macKeyHex: fullHex.slice(128, 192),
  };
}

/* -------------------------------------------------------------------------- */
/* AES wrap / unwrap                                                          */
/* -------------------------------------------------------------------------- */

export function wrapDek(dekHex: string, kekHex: string, ivHex?: string): { ivHex: string; ciphertext: string } {
  const iv = ivHex ? CryptoJS.enc.Hex.parse(ivHex) : CryptoJS.lib.WordArray.random(16);
  const kek = CryptoJS.enc.Hex.parse(kekHex);
  const dekBytes = CryptoJS.enc.Hex.parse(dekHex);
  const enc = CryptoJS.AES.encrypt(dekBytes, kek, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return { ivHex: iv.toString(CryptoJS.enc.Hex), ciphertext: enc.toString() };
}

export function unwrapDek(
  wrapped: { ivHex: string; ciphertext: string },
  kekHex: string,
): string {
  const kek = CryptoJS.enc.Hex.parse(kekHex);
  const iv = CryptoJS.enc.Hex.parse(wrapped.ivHex);
  const dec = CryptoJS.AES.decrypt(wrapped.ciphertext, kek, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  const hex = dec.toString(CryptoJS.enc.Hex);
  if (!hex || hex.length !== 64) {
    throw new Error('Unwrapped DEK is not 32 bytes — wrong key or corrupted ciphertext');
  }
  return hex;
}

/* -------------------------------------------------------------------------- */
/* MAC                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Canonical MAC input — fixed field order, pipe-separated. Covers EVERY
 * field that affects key derivation, verification or wrapped-key
 * interpretation. Deliberately excludes createdAt/updatedAt (not
 * security-relevant; changing them does not alter security properties).
 */
export function canonicalMacInput(env: {
  schema: string;
  vaultId: string;
  revision: number;
  kdf: { algorithm: string; iterations: number; saltHex: string; outputBytes?: number };
  wrappedKey: { algorithm: string; ivHex: string; ciphertext: string };
  verifierHex: string;
}): string {
  return [
    env.schema,
    env.vaultId,
    String(env.revision),
    env.kdf.algorithm,
    String(env.kdf.iterations),
    env.kdf.saltHex,
    String(env.kdf.outputBytes ?? ''),
    env.wrappedKey.algorithm,
    env.wrappedKey.ivHex,
    env.wrappedKey.ciphertext,
    env.verifierHex,
  ].join('|');
}

export function computeMac(input: string, macKeyHex: string): string {
  const key = CryptoJS.enc.Hex.parse(macKeyHex);
  return CryptoJS.HmacSHA256(input, key).toString(CryptoJS.enc.Hex);
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export function validateEnvelope(e: any): string[] {
  const errs: string[] = [];
  if (!e || typeof e !== 'object') return ['envelope is not an object'];
  if (e.schema !== RECOVERY_SCHEMA_V1 && e.schema !== RECOVERY_SCHEMA_V2) errs.push('schema unrecognised');
  if (typeof e.vaultId !== 'string' || !e.vaultId) errs.push('vaultId missing');
  if (typeof e.revision !== 'number' || !Number.isFinite(e.revision) || e.revision < 0) errs.push('revision invalid');
  if (typeof e.createdAt !== 'string' || !e.createdAt) errs.push('createdAt missing');
  if (typeof e.updatedAt !== 'string' || !e.updatedAt) errs.push('updatedAt missing');
  if (!e.kdf || e.kdf.algorithm !== KDF.algorithm) errs.push('kdf.algorithm mismatch');
  if (!e.kdf || typeof e.kdf.iterations !== 'number' || e.kdf.iterations < 10_000) errs.push('kdf.iterations invalid');
  if (!e.kdf || typeof e.kdf.saltHex !== 'string' || e.kdf.saltHex.length < 16) errs.push('kdf.saltHex invalid');
  if (e.schema === RECOVERY_SCHEMA_V2 && (!e.kdf || e.kdf.outputBytes !== KDF_V2_OUTPUT_BYTES)) errs.push('kdf.outputBytes must be 96 for v2');
  if (!e.wrappedKey || e.wrappedKey.algorithm !== WRAP_ALGO) errs.push('wrappedKey.algorithm mismatch');
  if (!e.wrappedKey || typeof e.wrappedKey.ivHex !== 'string' || e.wrappedKey.ivHex.length !== 32) errs.push('wrappedKey.ivHex invalid');
  if (!e.wrappedKey || typeof e.wrappedKey.ciphertext !== 'string' || !e.wrappedKey.ciphertext) errs.push('wrappedKey.ciphertext invalid');
  if (typeof e.verifierHex !== 'string' || e.verifierHex.length !== 64) errs.push('verifierHex invalid');
  if (e.schema === RECOVERY_SCHEMA_V2) {
    if (!e.mac || e.mac.algorithm !== MAC_ALGO) errs.push('mac.algorithm mismatch');
    if (!e.mac || typeof e.mac.hex !== 'string' || e.mac.hex.length !== 64) errs.push('mac.hex invalid');
  }
  return errs;
}

/* -------------------------------------------------------------------------- */
/* Envelope construction                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Build a NEW v2 envelope. `previousRevision` bumps to N+1. Used by initial
 * setup and by change-password. For deterministic v1 → v2 migration, use
 * `migrateEnvelopeV1ToV2` instead.
 */
export async function buildEnvelope(input: {
  dekHex: string;
  password: string;
  vaultId: string;
  previousRevision?: number;
  /** Override iv & salt for tests / deterministic construction. */
  fixedSaltHex?: string;
  fixedIvHex?: string;
  fixedCreatedAt?: string;
  fixedUpdatedAt?: string;
}): Promise<RecoveryEnvelopeV2> {
  const saltHex =
    input.fixedSaltHex ??
    bytesToHex(await randomBytes(KDF.saltBytes));
  const { kekHex, verifierHex, macKeyHex } = deriveKekVerifierAndMac(input.password, saltHex);
  const wrapped = wrapDek(input.dekHex, kekHex, input.fixedIvHex);
  const t = nowIso();
  const partial = {
    schema: RECOVERY_SCHEMA_V2,
    vaultId: input.vaultId,
    revision: (input.previousRevision || 0) + 1,
    createdAt: input.fixedCreatedAt ?? t,
    updatedAt: input.fixedUpdatedAt ?? t,
    kdf: { algorithm: KDF.algorithm, iterations: KDF.iterations, saltHex, outputBytes: 96 as 96 },
    wrappedKey: { algorithm: WRAP_ALGO, ...wrapped },
    verifierHex,
  };
  const macHex = computeMac(canonicalMacInput(partial), macKeyHex);
  return { ...partial, mac: { algorithm: MAC_ALGO, hex: macHex } };
}

/**
 * Deterministically migrate a v1 envelope to v2 IN PLACE.
 * Requires the (already-verified) password because it needs to derive
 * MAC_KEY. Preserves createdAt, updatedAt, revision, salt, iterations, IV and
 * ciphertext byte-for-byte. Result: any device performing the migration
 * produces a bit-identical v2 envelope.
 */
export function migrateEnvelopeV1ToV2(env: RecoveryEnvelopeV1, password: string): RecoveryEnvelopeV2 {
  const { kekHex, verifierHex, macKeyHex } = deriveKekVerifierAndMac(
    password, env.kdf.saltHex, env.kdf.iterations,
  );
  if (!constantTimeEqualHex(verifierHex, env.verifierHex)) {
    throw new Error('migrateEnvelopeV1ToV2: verifier mismatch (wrong password)');
  }
  const dek = unwrapDek(env.wrappedKey, kekHex);
  if (!dek || dek.length !== 64) throw new Error('migrateEnvelopeV1ToV2: unwrap sanity failed');

  const partial = {
    schema: RECOVERY_SCHEMA_V2,
    vaultId: env.vaultId,
    revision: env.revision,
    createdAt: env.createdAt,
    updatedAt: env.updatedAt,
    kdf: {
      algorithm: env.kdf.algorithm,
      iterations: env.kdf.iterations,
      saltHex: env.kdf.saltHex,
      outputBytes: 96 as 96,
    },
    wrappedKey: { ...env.wrappedKey },
    verifierHex: env.verifierHex,
  };
  const macHex = computeMac(canonicalMacInput(partial), macKeyHex);
  return { ...partial, mac: { algorithm: MAC_ALGO, hex: macHex } };
}

/* -------------------------------------------------------------------------- */
/* Password + MAC verification                                                */
/* -------------------------------------------------------------------------- */

export type PasswordCheckReason = 'malformed' | 'wrong-password' | 'tampered';
export type PasswordCheck =
  | { ok: true; kekHex: string; envelope: RecoveryEnvelope }
  | { ok: false; reason: PasswordCheckReason };

/**
 * The core verification pipeline. Ordered:
 *   1. Structural validate
 *   2. PBKDF2 derive
 *   3. Verifier compare  (wrong password → short-circuit)
 *   4. For v2: HMAC compute + constant-time compare (tampered → short-circuit)
 *
 * On success returns the KEK so the caller can unwrap. Does not itself
 * unwrap the DEK — that happens in restoreVault after this returns.
 */
export function checkPassword(envelope: RecoveryEnvelope, password: string): PasswordCheck {
  const errs = validateEnvelope(envelope);
  if (errs.length) return { ok: false, reason: 'malformed' };

  if (envelope.schema === RECOVERY_SCHEMA_V2) {
    const { kekHex, verifierHex, macKeyHex } = deriveKekVerifierAndMac(
      password, envelope.kdf.saltHex, envelope.kdf.iterations, envelope.kdf.outputBytes,
    );
    if (!constantTimeEqualHex(verifierHex, envelope.verifierHex)) return { ok: false, reason: 'wrong-password' };
    const expectedMac = computeMac(canonicalMacInput(envelope), macKeyHex);
    if (!constantTimeEqualHex(expectedMac, envelope.mac.hex)) return { ok: false, reason: 'tampered' };
    return { ok: true, kekHex, envelope };
  }

  // v1 — verifier only. Legacy envelopes have no MAC to verify.
  const { kekHex, verifierHex } = deriveKekAndVerifier(
    password, envelope.kdf.saltHex, envelope.kdf.iterations,
  );
  if (!constantTimeEqualHex(verifierHex, envelope.verifierHex)) return { ok: false, reason: 'wrong-password' };
  return { ok: true, kekHex, envelope };
}

/* -------------------------------------------------------------------------- */
/* Rollback protection                                                        */
/* -------------------------------------------------------------------------- */

function highestRevKey(vaultId: string): string {
  return HIGHEST_REV_KEY_PREFIX + vaultId;
}

export async function getHighestAcceptedRevision(vaultId: string): Promise<number | null> {
  const raw = await secureStore.get(highestRevKey(vaultId));
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Only ever call after the FULL verification pipeline has succeeded. */
async function updateHighestAcceptedRevision(vaultId: string, revision: number): Promise<void> {
  const current = await getHighestAcceptedRevision(vaultId);
  if (current === null || revision > current) {
    await secureStore.set(highestRevKey(vaultId), String(revision));
  }
}

export type RollbackDecision =
  | { allow: true; localHigh: number | null }
  | { allow: false; reason: 'rollback'; localHigh: number };

/**
 * Pure helper — decides whether an envelope's revision is acceptable given
 * this device's history. Update the local state via
 * `updateHighestAcceptedRevision` ONLY after full verification.
 */
export function checkRollback(envelopeRev: number, localHigh: number | null): RollbackDecision {
  if (typeof envelopeRev !== 'number' || !Number.isFinite(envelopeRev) || envelopeRev < 0) {
    // Structural failure — treat as rollback for safety.
    return { allow: false, reason: 'rollback', localHigh: localHigh ?? 0 };
  }
  if (localHigh === null) return { allow: true, localHigh: null };
  if (envelopeRev < localHigh) return { allow: false, reason: 'rollback', localHigh };
  return { allow: true, localHigh };
}

/* -------------------------------------------------------------------------- */
/* Drive I/O                                                                  */
/* -------------------------------------------------------------------------- */

function encodeEnvelope(env: RecoveryEnvelope): string { return JSON.stringify(env); }

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

export async function fetchEnvelopeMetadata(user: AuthUser): Promise<
  { revision: number; updatedAt: string; vaultId: string; fileId: string } | null
> {
  const primary = await findEnvelope(user, RECOVERY_FILE_NAME);
  if (!primary) return null;
  const revStr = primary.appProperties?.['safevault.revision'];
  const updatedAt = primary.appProperties?.['safevault.updatedAt'];
  if (!revStr || !updatedAt) {
    const full = await fetchEnvelope(user);
    if (!full) return null;
    return {
      revision: full.envelope.revision,
      updatedAt: full.envelope.updatedAt,
      vaultId: full.envelope.vaultId,
      fileId: full.fileId,
    };
  }
  return {
    revision: Number(revStr),
    updatedAt,
    vaultId: 'sv_' + (user.id || 'anon'),
    fileId: primary.id,
  };
}

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

  // Rotate primary → backup before overwriting.
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

export async function setupRecovery(input: {
  user: AuthUser;
  password: string;
}): Promise<{ setUp: true; alreadySetUp: boolean; fileId: string }> {
  const { user, password } = input;
  const dekHex = await getKey();
  if (!dekHex) throw new Error('No encryption key on this device — cannot set up recovery yet');

  const existing = await fetchEnvelope(user);
  if (existing) {
    const check = checkPassword(existing.envelope, password);
    if (check.ok) {
      try {
        const unwrapped = unwrapDek(existing.envelope.wrappedKey, check.kekHex);
        if (unwrapped === dekHex) {
          // Same-DEK/same-password: opportunistically migrate v1 → v2 (idempotent).
          if (existing.envelope.schema === RECOVERY_SCHEMA_V1) {
            const migrated = migrateEnvelopeV1ToV2(existing.envelope, password);
            try { await saveEnvelope(user, migrated); } catch { /* soft */ }
          }
          await secureStore.set(RECOVERY_LOCAL_FLAG, '1');
          await updateHighestAcceptedRevision(existing.envelope.vaultId, existing.envelope.revision);
          return { setUp: true, alreadySetUp: true, fileId: existing.fileId };
        }
      } catch { /* fall through */ }
    }
    const e = new Error('An existing recovery envelope was found for a different password/DEK. Use Change Recovery Password to re-wrap.');
    (e as any).code = 'RecoveryEnvelopeConflictError';
    throw e;
  }

  const vaultId = 'sv_' + (user.id || 'anon');
  const env = await buildEnvelope({ dekHex, password, vaultId });
  const saved = await saveEnvelope(user, env);
  await secureStore.set(RECOVERY_LOCAL_FLAG, '1');
  await updateHighestAcceptedRevision(vaultId, env.revision);
  return { setUp: true, alreadySetUp: false, fileId: saved.fileId };
}

export type RestoreResult =
  | { ok: true; dekHex: string; envelope: RecoveryEnvelope; recovered: boolean; migrated: boolean }
  | { ok: false; reason: 'no-envelope' | 'wrong-password' | 'malformed' | 'corrupted' | 'tampered' | 'rollback' | 'no-drive' };

export async function restoreVault(input: {
  user: AuthUser;
  password: string;
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
  const envelope = fetched.envelope;
  const vaultId = envelope.vaultId;

  // 1. Rollback check — BEFORE any crypto work.
  const localHigh = await getHighestAcceptedRevision(vaultId);
  const roll = checkRollback(envelope.revision, localHigh);
  if (!roll.allow) return { ok: false, reason: 'rollback' };

  // 2. Password + MAC verification (verifier then HMAC then AES).
  const check = checkPassword(envelope, password);
  if (!check.ok) {
    if (check.reason === 'wrong-password') return { ok: false, reason: 'wrong-password' };
    if (check.reason === 'tampered') return { ok: false, reason: 'tampered' };
    return { ok: false, reason: 'malformed' };
  }

  // 3. AES unwrap.
  let dekHex: string;
  try {
    dekHex = unwrapDek(envelope.wrappedKey, check.kekHex);
  } catch {
    return { ok: false, reason: 'tampered' };
  }
  if (!dekHex || dekHex.length !== 64) return { ok: false, reason: 'tampered' };

  // 4. Only NOW do we commit — install DEK + update local high + best-effort
  //    migrate v1 → v2 in Drive.
  let migrated = false;
  if (commit) {
    await secureStore.set(DEK_STORE_KEY, dekHex);
    await secureStore.set(RECOVERY_LOCAL_FLAG, '1');
    await updateHighestAcceptedRevision(vaultId, envelope.revision);
    // Crash-safe migration: v1 envelope is NOT deleted here — we simply
    // overwrite `recovery.json` with the v2 payload. If the write fails, v1
    // remains valid and unlockable; next restore will retry.
    if (envelope.schema === RECOVERY_SCHEMA_V1) {
      try {
        const v2 = migrateEnvelopeV1ToV2(envelope, password);
        await saveEnvelope(user, v2);
        migrated = true;
      } catch (e) {
        // Migration failure is non-fatal — DEK is already installed.
        // eslint-disable-next-line no-console
        console.warn('[recovery] v1→v2 migration failed (will retry on next restore):', (e as Error).message);
      }
    }
  }
  return { ok: true, dekHex, envelope, recovered: fetched.recovered, migrated };
}

export async function changeRecoveryPassword(input: {
  user: AuthUser;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true; fileId: string } | { ok: false; reason: 'wrong-password' | 'tampered' | 'no-envelope' | 'no-dek' | 'malformed' }> {
  const dekHex = await getKey();
  if (!dekHex) return { ok: false, reason: 'no-dek' };

  const existing = await fetchEnvelope(input.user);
  if (!existing) return { ok: false, reason: 'no-envelope' };

  const check = checkPassword(existing.envelope, input.currentPassword);
  if (!check.ok) {
    if (check.reason === 'wrong-password') return { ok: false, reason: 'wrong-password' };
    if (check.reason === 'tampered') return { ok: false, reason: 'tampered' };
    return { ok: false, reason: 'malformed' };
  }

  const vaultId = existing.envelope.vaultId;
  const env = await buildEnvelope({
    dekHex,
    password: input.newPassword,
    vaultId,
    previousRevision: existing.envelope.revision,
  });
  const saved = await saveEnvelope(input.user, env);
  await updateHighestAcceptedRevision(vaultId, env.revision);
  return { ok: true, fileId: saved.fileId };
}

/* -------------------------------------------------------------------------- */
/* Small helpers used by settings screens                                     */
/* -------------------------------------------------------------------------- */

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
  RECOVERY_SCHEMA_V1,
  RECOVERY_SCHEMA_V2,
  RECOVERY_SCHEMA_CURRENT,
  RECOVERY_SCHEMA,
  KDF,
  KDF_V1_OUTPUT_BYTES,
  KDF_V2_OUTPUT_BYTES,
  WRAP_ALGO,
  MAC_ALGO,
  deriveKekAndVerifier,
  deriveKekVerifierAndMac,
  wrapDek,
  unwrapDek,
  canonicalMacInput,
  computeMac,
  constantTimeEqualHex,
  validateEnvelope,
  buildEnvelope,
  migrateEnvelopeV1ToV2,
  checkPassword,
  checkRollback,
  getHighestAcceptedRevision,
  fetchEnvelope,
  fetchEnvelopeMetadata,
  saveEnvelope,
  setupRecovery,
  restoreVault,
  changeRecoveryPassword,
  isRecoveryConfiguredLocally,
  markRecoveryConfiguredLocally,
  clearLocalRecoveryFlag,
};
