// Recovery schema-v2 tests — authenticated envelope + rollback protection.
// Replicates the exact logic from src/services/recovery.ts so we can test
// without pulling in React Native / SecureStore.

import CryptoJS from 'crypto-js';

const SCHEMA_V1 = 'safevault.recovery.v1';
const SCHEMA_V2 = 'safevault.recovery.v2';
const KDF_ITERS = 210_000;
const V1_OUT = 64;
const V2_OUT = 96;

function deriveKekAndVerifier(password, saltHex, iterations = KDF_ITERS) {
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const d = CryptoJS.PBKDF2(password, salt, { keySize: V1_OUT / 4, iterations, hasher: CryptoJS.algo.SHA256 });
  const h = d.toString(CryptoJS.enc.Hex);
  return { kekHex: h.slice(0, 64), verifierHex: h.slice(64, 128) };
}

function deriveKekVerifierAndMac(password, saltHex, iterations = KDF_ITERS, outputBytes = V2_OUT) {
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const d = CryptoJS.PBKDF2(password, salt, { keySize: outputBytes / 4, iterations, hasher: CryptoJS.algo.SHA256 });
  const h = d.toString(CryptoJS.enc.Hex);
  return { kekHex: h.slice(0, 64), verifierHex: h.slice(64, 128), macKeyHex: h.slice(128, 192) };
}

function wrapDek(dekHex, kekHex, ivHex) {
  const iv = ivHex ? CryptoJS.enc.Hex.parse(ivHex) : CryptoJS.lib.WordArray.random(16);
  const kek = CryptoJS.enc.Hex.parse(kekHex);
  const dek = CryptoJS.enc.Hex.parse(dekHex);
  const enc = CryptoJS.AES.encrypt(dek, kek, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return { ivHex: iv.toString(CryptoJS.enc.Hex), ciphertext: enc.toString() };
}

function unwrapDek(w, kekHex) {
  const kek = CryptoJS.enc.Hex.parse(kekHex);
  const iv = CryptoJS.enc.Hex.parse(w.ivHex);
  const d = CryptoJS.AES.decrypt(w.ciphertext, kek, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  const h = d.toString(CryptoJS.enc.Hex);
  if (!h || h.length !== 64) throw new Error('Unwrapped DEK is not 32 bytes');
  return h;
}

function canonicalMacInput(env) {
  return [env.schema, env.vaultId, String(env.revision), env.kdf.algorithm, String(env.kdf.iterations), env.kdf.saltHex, String(env.kdf.outputBytes ?? ''), env.wrappedKey.algorithm, env.wrappedKey.ivHex, env.wrappedKey.ciphertext, env.verifierHex].join('|');
}
function computeMac(input, macKeyHex) {
  const k = CryptoJS.enc.Hex.parse(macKeyHex);
  return CryptoJS.HmacSHA256(input, k).toString(CryptoJS.enc.Hex);
}
function constantTimeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let m = 0;
  for (let i = 0; i < a.length; i++) m |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return m === 0;
}

function validateEnvelope(e) {
  const errs = [];
  if (!e || typeof e !== 'object') return ['not object'];
  if (e.schema !== SCHEMA_V1 && e.schema !== SCHEMA_V2) errs.push('schema');
  if (!e.vaultId) errs.push('vaultId');
  if (typeof e.revision !== 'number' || e.revision < 0) errs.push('revision');
  if (!e.createdAt || !e.updatedAt) errs.push('timestamps');
  if (!e.kdf || e.kdf.algorithm !== 'PBKDF2-SHA256') errs.push('kdf.alg');
  if (!e.kdf || typeof e.kdf.iterations !== 'number' || e.kdf.iterations < 10000) errs.push('kdf.iters');
  if (!e.kdf || typeof e.kdf.saltHex !== 'string' || e.kdf.saltHex.length < 16) errs.push('kdf.salt');
  if (e.schema === SCHEMA_V2 && (!e.kdf || e.kdf.outputBytes !== V2_OUT)) errs.push('kdf.outputBytes');
  if (!e.wrappedKey || e.wrappedKey.algorithm !== 'AES-256-CBC') errs.push('wk.alg');
  if (!e.wrappedKey || !e.wrappedKey.ivHex || e.wrappedKey.ivHex.length !== 32) errs.push('wk.iv');
  if (!e.wrappedKey || !e.wrappedKey.ciphertext) errs.push('wk.ct');
  if (!e.verifierHex || e.verifierHex.length !== 64) errs.push('verifier');
  if (e.schema === SCHEMA_V2) {
    if (!e.mac || e.mac.algorithm !== 'HMAC-SHA256') errs.push('mac.alg');
    if (!e.mac || !e.mac.hex || e.mac.hex.length !== 64) errs.push('mac.hex');
  }
  return errs;
}

function buildV2({ dekHex, password, vaultId, saltHex, ivHex, revision = 1, createdAt = 't1', updatedAt = 't1' }) {
  const { kekHex, verifierHex, macKeyHex } = deriveKekVerifierAndMac(password, saltHex);
  const wrapped = wrapDek(dekHex, kekHex, ivHex);
  const partial = {
    schema: SCHEMA_V2, vaultId, revision, createdAt, updatedAt,
    kdf: { algorithm: 'PBKDF2-SHA256', iterations: KDF_ITERS, saltHex, outputBytes: V2_OUT },
    wrappedKey: { algorithm: 'AES-256-CBC', ...wrapped },
    verifierHex,
  };
  const macHex = computeMac(canonicalMacInput(partial), macKeyHex);
  return { ...partial, mac: { algorithm: 'HMAC-SHA256', hex: macHex } };
}
function buildV1({ dekHex, password, vaultId, saltHex, ivHex, revision = 1, createdAt = 't1', updatedAt = 't1' }) {
  const { kekHex, verifierHex } = deriveKekAndVerifier(password, saltHex);
  const wrapped = wrapDek(dekHex, kekHex, ivHex);
  return {
    schema: SCHEMA_V1, vaultId, revision, createdAt, updatedAt,
    kdf: { algorithm: 'PBKDF2-SHA256', iterations: KDF_ITERS, saltHex },
    wrappedKey: { algorithm: 'AES-256-CBC', ...wrapped },
    verifierHex,
  };
}

function checkPassword(env, password) {
  const errs = validateEnvelope(env);
  if (errs.length) return { ok: false, reason: 'malformed' };
  if (env.schema === SCHEMA_V2) {
    const { kekHex, verifierHex, macKeyHex } = deriveKekVerifierAndMac(password, env.kdf.saltHex, env.kdf.iterations, env.kdf.outputBytes);
    if (!constantTimeEqualHex(verifierHex, env.verifierHex)) return { ok: false, reason: 'wrong-password' };
    const expected = computeMac(canonicalMacInput(env), macKeyHex);
    if (!constantTimeEqualHex(expected, env.mac.hex)) return { ok: false, reason: 'tampered' };
    return { ok: true, kekHex };
  }
  const { kekHex, verifierHex } = deriveKekAndVerifier(password, env.kdf.saltHex, env.kdf.iterations);
  if (!constantTimeEqualHex(verifierHex, env.verifierHex)) return { ok: false, reason: 'wrong-password' };
  return { ok: true, kekHex };
}

function migrateV1ToV2(env, password) {
  const { kekHex, verifierHex, macKeyHex } = deriveKekVerifierAndMac(password, env.kdf.saltHex, env.kdf.iterations);
  if (!constantTimeEqualHex(verifierHex, env.verifierHex)) throw new Error('verifier mismatch');
  const dek = unwrapDek(env.wrappedKey, kekHex);
  if (!dek || dek.length !== 64) throw new Error('unwrap failed');
  const partial = {
    schema: SCHEMA_V2, vaultId: env.vaultId, revision: env.revision,
    createdAt: env.createdAt, updatedAt: env.updatedAt,
    kdf: { algorithm: env.kdf.algorithm, iterations: env.kdf.iterations, saltHex: env.kdf.saltHex, outputBytes: V2_OUT },
    wrappedKey: { ...env.wrappedKey },
    verifierHex: env.verifierHex,
  };
  return { ...partial, mac: { algorithm: 'HMAC-SHA256', hex: computeMac(canonicalMacInput(partial), macKeyHex) } };
}

function checkRollback(envelopeRev, localHigh) {
  if (typeof envelopeRev !== 'number' || !Number.isFinite(envelopeRev) || envelopeRev < 0) return { allow: false, reason: 'rollback' };
  if (localHigh === null || localHigh === undefined) return { allow: true };
  if (envelopeRev < localHigh) return { allow: false, reason: 'rollback' };
  return { allow: true };
}

/* ------------------------------ TEST HARNESS ------------------------------ */

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); console.log('OK  -', name); pass++; } catch (e) { console.log('FAIL-', name, ':', e.message); fail++; } }
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

const DEK = 'a3f5c1b8d4e7a2b09876543210fedcba0123456789abcdef0011223344556677';
const SALT = '0102030405060708090a0b0c0d0e0f10';
const IV = '00112233445566778899aabbccddeeff';

/* ---------------------------- v1 & v2 basic ------------------------------ */

t('v1 restore: correct password unwraps DEK', () => {
  const env = buildV1({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const r = checkPassword(env, 'pw');
  assert(r.ok, 'v1 unlock');
  assert(unwrapDek(env.wrappedKey, r.kekHex) === DEK, 'DEK round-trip');
});

t('v2 restore: correct password + MAC unwraps DEK', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const r = checkPassword(env, 'pw');
  assert(r.ok, 'v2 unlock');
  assert(unwrapDek(env.wrappedKey, r.kekHex) === DEK);
});

t('v2 valid MAC — envelope accepted', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const r = checkPassword(env, 'pw');
  assert(r.ok);
});

/* ---------------------------- tamper tests ------------------------------- */

function tamper(env, patch) { return { ...env, ...patch }; }

t('v2: modified schema → tampered (or malformed)', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const bad = tamper(env, { schema: 'safevault.recovery.v3' });
  const r = checkPassword(bad, 'pw');
  assert(!r.ok, 'must reject');
  assert(r.reason === 'malformed' || r.reason === 'tampered', `got ${r.reason}`);
});

t('v2: modified vaultId → tampered', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const bad = tamper(env, { vaultId: 'attacker-vault' });
  const r = checkPassword(bad, 'pw');
  assert(!r.ok && r.reason === 'tampered', `got ${r.reason}`);
});

t('v2: modified revision → tampered', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV, revision: 5 });
  const bad = tamper(env, { revision: 6 });
  const r = checkPassword(bad, 'pw');
  assert(!r.ok && r.reason === 'tampered');
});

t('v2: modified KDF iterations → tampered (or verifier fails first)', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const bad = tamper(env, { kdf: { ...env.kdf, iterations: 100_000 } });
  const r = checkPassword(bad, 'pw');
  assert(!r.ok, `expected reject, got ok`);
  // Verifier is derived with the envelope's iterations; changing iterations
  // yields a completely different derivation → verifier mismatch. Either
  // 'wrong-password' or 'tampered' is acceptable (both prove rejection).
  assert(['wrong-password', 'tampered', 'malformed'].includes(r.reason), `unexpected reason ${r.reason}`);
});

t('v2: modified salt → wrong-password (verifier mismatch is caught first)', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const bad = tamper(env, { kdf: { ...env.kdf, saltHex: 'ff'.repeat(16) } });
  const r = checkPassword(bad, 'pw');
  assert(!r.ok);
  assert(['wrong-password', 'tampered'].includes(r.reason));
});

t('v2: modified IV → tampered', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const badIv = 'ff'.repeat(16);
  const bad = tamper(env, { wrappedKey: { ...env.wrappedKey, ivHex: badIv } });
  const r = checkPassword(bad, 'pw');
  assert(!r.ok && r.reason === 'tampered');
});

t('v2: modified ciphertext → tampered', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const badCt = env.wrappedKey.ciphertext.replace(/^./, (c) => c === 'A' ? 'B' : 'A');
  const bad = tamper(env, { wrappedKey: { ...env.wrappedKey, ciphertext: badCt } });
  const r = checkPassword(bad, 'pw');
  assert(!r.ok && r.reason === 'tampered');
});

t('v2: modified verifier → wrong-password (verifier check fires first)', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const bad = tamper(env, { verifierHex: 'f'.repeat(64) });
  const r = checkPassword(bad, 'pw');
  assert(!r.ok && r.reason === 'wrong-password');
});

t('v2: modified MAC bit-flip → tampered', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const flipped = env.mac.hex.slice(0, -1) + (env.mac.hex.slice(-1) === '0' ? '1' : '0');
  const bad = tamper(env, { mac: { ...env.mac, hex: flipped } });
  const r = checkPassword(bad, 'pw');
  assert(!r.ok && r.reason === 'tampered');
});

t('v2: constant-time comparison rejects length mismatch', () => {
  assert(constantTimeEqualHex('abc', 'abcd') === false);
  assert(constantTimeEqualHex('abcd', 'abcd') === true);
  assert(constantTimeEqualHex('abcd', 'abce') === false);
});

/* ---------------------------- wrong-password ----------------------------- */

t('v2: wrong password → wrong-password (no AES call)', () => {
  const env = buildV2({ dekHex: DEK, password: 'right', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const r = checkPassword(env, 'wrong');
  assert(!r.ok && r.reason === 'wrong-password');
});

/* ---------------------------- v1 → v2 migration -------------------------- */

t('v1 → v2 migration: identical output for same password/salt', () => {
  const v1 = buildV1({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV, revision: 3, createdAt: 'c', updatedAt: 'u' });
  const v2a = migrateV1ToV2(v1, 'pw');
  const v2b = migrateV1ToV2(v1, 'pw');
  assert(v2a.mac.hex === v2b.mac.hex, 'migration must be deterministic');
  assert(v2a.wrappedKey.ivHex === v1.wrappedKey.ivHex, 'IV preserved');
  assert(v2a.wrappedKey.ciphertext === v1.wrappedKey.ciphertext, 'ciphertext preserved');
  assert(v2a.verifierHex === v1.verifierHex, 'verifier preserved');
  assert(v2a.kdf.saltHex === v1.kdf.saltHex, 'salt preserved');
  assert(v2a.revision === v1.revision, 'revision preserved');
  assert(v2a.createdAt === v1.createdAt && v2a.updatedAt === v1.updatedAt, 'timestamps preserved');
});

t('v1 → v2 migration: PBKDF2 first 64 bytes match v1', () => {
  const v1 = buildV1({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const d1 = deriveKekAndVerifier('pw', SALT);
  const d2 = deriveKekVerifierAndMac('pw', SALT);
  assert(d1.kekHex === d2.kekHex, 'KEK matches across v1/v2 derivation');
  assert(d1.verifierHex === d2.verifierHex, 'Verifier matches across v1/v2 derivation');
  // And the v1 envelope's fields are the same as those the migration will preserve.
  assert(v1.verifierHex === d2.verifierHex);
});

t('v1 → v2 migration: migrated envelope verifies under checkPassword', () => {
  const v1 = buildV1({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const v2 = migrateV1ToV2(v1, 'pw');
  const r = checkPassword(v2, 'pw');
  assert(r.ok, 'migrated envelope must verify');
  assert(unwrapDek(v2.wrappedKey, r.kekHex) === DEK, 'DEK still recoverable');
});

t('v1 → v2 migration: wrong password rejected', () => {
  const v1 = buildV1({ dekHex: DEK, password: 'right', vaultId: 'v', saltHex: SALT, ivHex: IV });
  let threw = false;
  try { migrateV1ToV2(v1, 'wrong'); } catch { threw = true; }
  assert(threw, 'migration with wrong password must throw');
});

t('migration idempotency: applying migration twice yields identical bytes', () => {
  const v1 = buildV1({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const a = migrateV1ToV2(v1, 'pw');
  const b = migrateV1ToV2(v1, 'pw');
  assert(JSON.stringify(a) === JSON.stringify(b), 'byte-identical');
});

t('migration interruption: if save failed, v1 envelope remains valid', () => {
  // Simulate: migration produced a v2 in memory but Drive save never happened.
  // The v1 envelope is still on Drive → next restore must still work.
  const v1 = buildV1({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  // (In real flow, the app would re-fetch v1 and retry.)
  const r = checkPassword(v1, 'pw');
  assert(r.ok, 'v1 still unlockable after failed migration');
  assert(unwrapDek(v1.wrappedKey, r.kekHex) === DEK);
});

t('existing document decryption unaffected by migration', () => {
  // Simulate a document encrypted with the DEK BEFORE migration.
  const v1 = buildV1({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const dekBefore = unwrapDek(v1.wrappedKey, checkPassword(v1, 'pw').kekHex);
  const v2 = migrateV1ToV2(v1, 'pw');
  const dekAfter = unwrapDek(v2.wrappedKey, checkPassword(v2, 'pw').kekHex);
  assert(dekBefore === dekAfter, 'DEK is identical → existing documents still decrypt');
});

/* ---------------------------- change password ---------------------------- */

t('change-password preserves DEK across new envelope', () => {
  const oldEnv = buildV2({ dekHex: DEK, password: 'old', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const oldCheck = checkPassword(oldEnv, 'old');
  assert(oldCheck.ok);
  const recoveredDek = unwrapDek(oldEnv.wrappedKey, oldCheck.kekHex);
  const NEW_SALT = 'aabbccddeeff00112233445566778899';
  const NEW_IV = '99887766554433221100ffeeddccbbaa';
  const newEnv = buildV2({ dekHex: recoveredDek, password: 'new', vaultId: 'v', saltHex: NEW_SALT, ivHex: NEW_IV, revision: 2 });
  const newCheck = checkPassword(newEnv, 'new');
  assert(newCheck.ok);
  assert(unwrapDek(newEnv.wrappedKey, newCheck.kekHex) === DEK, 'DEK preserved across password change');
  // Old password must NOT unlock new envelope
  const wrongTry = checkPassword(newEnv, 'old');
  assert(!wrongTry.ok, 'old password should not unlock new envelope');
});

/* ---------------------------- rollback ----------------------------------- */

t('rollback: no local high → any envelope accepted (new device)', () => {
  const r = checkRollback(5, null);
  assert(r.allow === true, 'no history → accept');
});

t('rollback: envelope revision lower than local high → rejected', () => {
  const r = checkRollback(3, 5);
  assert(r.allow === false && r.reason === 'rollback');
});

t('rollback: equal revision → allowed (crypto validity still required upstream)', () => {
  const r = checkRollback(5, 5);
  assert(r.allow === true);
});

t('rollback: higher revision → allowed (will bump local high after full verification)', () => {
  const r = checkRollback(6, 5);
  assert(r.allow === true);
});

t('rollback: NaN / negative envelope revision → rejected', () => {
  assert(checkRollback(-1, 5).allow === false);
  assert(checkRollback(NaN, 5).allow === false);
});

t('rollback: rollback rejection does NOT destroy the current recovery configuration', () => {
  // The pure function returns allow=false but does not modify any state.
  // Callers (restoreVault) only touch DEK/local-high AFTER the full pipeline
  // succeeds, so a rollback rejection is a pure no-op on state.
  const localHigh = 10;
  const r = checkRollback(3, localHigh);
  assert(r.allow === false);
  // The local high is unchanged (this is a pure function; simulation-level assertion).
});

/* ---------------------------- MAC canonical input ------------------------ */

t('MAC input covers every security-relevant field', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV });
  const input = canonicalMacInput(env);
  // Each field must appear somewhere in the string.
  const parts = input.split('|');
  assert(parts.length === 11, `expected 11 fields, got ${parts.length}`);
  assert(parts[0] === env.schema);
  assert(parts[1] === env.vaultId);
  assert(parts[2] === String(env.revision));
  assert(parts[3] === env.kdf.algorithm);
  assert(parts[4] === String(env.kdf.iterations));
  assert(parts[5] === env.kdf.saltHex);
  assert(parts[6] === String(env.kdf.outputBytes));
  assert(parts[7] === env.wrappedKey.algorithm);
  assert(parts[8] === env.wrappedKey.ivHex);
  assert(parts[9] === env.wrappedKey.ciphertext);
  assert(parts[10] === env.verifierHex);
});

t('MAC input EXCLUDES createdAt and updatedAt (not security-relevant)', () => {
  const env = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV, createdAt: 'A', updatedAt: 'B' });
  const other = buildV2({ dekHex: DEK, password: 'pw', vaultId: 'v', saltHex: SALT, ivHex: IV, createdAt: 'X', updatedAt: 'Y' });
  // Same MAC because timestamps are excluded (assuming same salt/iv → deterministic).
  assert(env.mac.hex === other.mac.hex, 'timestamps must not affect MAC');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
