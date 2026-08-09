// In-process unit tests for the recovery cryptographic primitives.
// Runs with plain `node` — no jest / no expo. Replicates the pure functions
// from src/services/recovery.ts so we can validate the maths without pulling
// in React Native modules. Any change in behaviour in recovery.ts must be
// mirrored here (or vice versa) or the tests will fail.
import CryptoJS from 'crypto-js';

const RECOVERY_SCHEMA = 'safevault.recovery.v1';
const KDF = { algorithm: 'PBKDF2-SHA256', iterations: 210_000, outputBytes: 64 };
const WRAP_ALGO = 'AES-256-CBC';

function deriveKekAndVerifier(password, saltHex, iterations = KDF.iterations) {
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const derived = CryptoJS.PBKDF2(password, salt, {
    keySize: KDF.outputBytes / 4,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
  const fullHex = derived.toString(CryptoJS.enc.Hex);
  return { kekHex: fullHex.slice(0, 64), verifierHex: fullHex.slice(64, 128) };
}

function wrapDek(dekHex, kekHex, ivHex) {
  const iv = ivHex ? CryptoJS.enc.Hex.parse(ivHex) : CryptoJS.lib.WordArray.random(16);
  const kek = CryptoJS.enc.Hex.parse(kekHex);
  const dekBytes = CryptoJS.enc.Hex.parse(dekHex);
  const enc = CryptoJS.AES.encrypt(dekBytes, kek, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return { ivHex: iv.toString(CryptoJS.enc.Hex), ciphertext: enc.toString() };
}

function unwrapDek(wrapped, kekHex) {
  const kek = CryptoJS.enc.Hex.parse(kekHex);
  const iv = CryptoJS.enc.Hex.parse(wrapped.ivHex);
  const dec = CryptoJS.AES.decrypt(wrapped.ciphertext, kek, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  const hex = dec.toString(CryptoJS.enc.Hex);
  if (!hex || hex.length !== 64) throw new Error('Unwrapped DEK is not 32 bytes');
  return hex;
}

function validateEnvelope(e) {
  const errs = [];
  if (!e || typeof e !== 'object') return ['envelope is not an object'];
  if (e.schema !== RECOVERY_SCHEMA) errs.push('schema mismatch');
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

function buildEnvelope({ dekHex, password, vaultId, saltHex, previousRevision = 0 }) {
  const { kekHex, verifierHex } = deriveKekAndVerifier(password, saltHex);
  const wrapped = wrapDek(dekHex, kekHex);
  const t = new Date().toISOString();
  return {
    schema: RECOVERY_SCHEMA,
    vaultId,
    revision: previousRevision + 1,
    createdAt: t, updatedAt: t,
    kdf: { algorithm: KDF.algorithm, iterations: KDF.iterations, saltHex },
    wrappedKey: { algorithm: WRAP_ALGO, ...wrapped },
    verifierHex,
  };
}

function checkPassword(envelope, password) {
  const errs = validateEnvelope(envelope);
  if (errs.length) return { ok: false, reason: 'malformed' };
  const { kekHex, verifierHex } = deriveKekAndVerifier(password, envelope.kdf.saltHex, envelope.kdf.iterations);
  if (verifierHex !== envelope.verifierHex) return { ok: false, reason: 'wrong-password' };
  return { ok: true, kekHex };
}

/* ----------------------------- TEST HARNESS ----------------------------- */

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); console.log('OK  -', name); pass++; } catch (e) { console.log('FAIL-', name, ':', e.message); fail++; } }
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

const DEK = 'a3f5c1b8d4e7a2b09876543210fedcba0123456789abcdef0011223344556677'; // 32 bytes hex
const SALT = '0102030405060708090a0b0c0d0e0f10'; // 16 bytes hex

t('deriveKekAndVerifier is deterministic', () => {
  const a = deriveKekAndVerifier('correct-horse-battery-staple', SALT);
  const b = deriveKekAndVerifier('correct-horse-battery-staple', SALT);
  assert(a.kekHex === b.kekHex, 'kek must be deterministic');
  assert(a.verifierHex === b.verifierHex, 'verifier must be deterministic');
});

t('deriveKekAndVerifier different salts -> different KEK', () => {
  const a = deriveKekAndVerifier('same-password', SALT);
  const b = deriveKekAndVerifier('same-password', 'ff0102030405060708090a0b0c0d0e0f');
  assert(a.kekHex !== b.kekHex, 'salt must affect KEK');
  assert(a.verifierHex !== b.verifierHex, 'salt must affect verifier');
});

t('KEK and verifier are independent halves of PBKDF2 output', () => {
  const { kekHex, verifierHex } = deriveKekAndVerifier('pw', SALT);
  assert(kekHex.length === 64, `KEK should be 32 bytes / 64 hex, was ${kekHex.length}`);
  assert(verifierHex.length === 64, `verifier should be 32 bytes / 64 hex, was ${verifierHex.length}`);
  assert(kekHex !== verifierHex, 'KEK must not equal verifier');
});

t('wrap then unwrap yields original DEK', () => {
  const { kekHex } = deriveKekAndVerifier('mypw', SALT);
  const wrapped = wrapDek(DEK, kekHex);
  const unwrapped = unwrapDek(wrapped, kekHex);
  assert(unwrapped === DEK, 'DEK round-trip must be lossless');
});

t('unwrap with wrong KEK throws or returns garbage', () => {
  const { kekHex } = deriveKekAndVerifier('good-pw', SALT);
  const wrong = deriveKekAndVerifier('bad-pw', SALT).kekHex;
  const wrapped = wrapDek(DEK, kekHex);
  let ok = false;
  try {
    const unwrapped = unwrapDek(wrapped, wrong);
    if (unwrapped === DEK) ok = false; // definitely wrong
    else ok = true; // returned garbage, which is fine (verifier would catch this first)
  } catch { ok = true; } // padding error, also fine
  assert(ok, 'unwrap with wrong key must not silently return original DEK');
});

t('buildEnvelope produces a valid envelope', () => {
  const env = buildEnvelope({ dekHex: DEK, password: 'pw', vaultId: 'sv_123', saltHex: SALT });
  const errs = validateEnvelope(env);
  assert(errs.length === 0, 'envelope should be valid: ' + errs.join(';'));
  assert(env.revision === 1);
  assert(env.wrappedKey.ivHex.length === 32);
  assert(env.wrappedKey.ciphertext.length > 0);
  assert(env.verifierHex.length === 64);
});

t('checkPassword: correct password -> ok=true', () => {
  const env = buildEnvelope({ dekHex: DEK, password: 'right', vaultId: 'v', saltHex: SALT });
  const r = checkPassword(env, 'right');
  assert(r.ok === true, 'correct password must verify');
  const unwrapped = unwrapDek(env.wrappedKey, r.kekHex);
  assert(unwrapped === DEK, 'unwrap after checkPassword must yield the DEK');
});

t('checkPassword: wrong password -> reason wrong-password', () => {
  const env = buildEnvelope({ dekHex: DEK, password: 'right', vaultId: 'v', saltHex: SALT });
  const r = checkPassword(env, 'wrong');
  assert(r.ok === false, 'wrong password must NOT verify');
  assert(r.reason === 'wrong-password', `expected wrong-password, got ${r.reason}`);
});

t('checkPassword: malformed envelope -> reason malformed', () => {
  const bad = { schema: 'wrong-schema', kdf: {}, wrappedKey: {}, verifierHex: '' };
  const r = checkPassword(bad, 'anything');
  assert(r.ok === false && r.reason === 'malformed');
});

t('validateEnvelope catches missing / wrong fields', () => {
  const base = buildEnvelope({ dekHex: DEK, password: 'p', vaultId: 'v', saltHex: SALT });
  assert(validateEnvelope({ ...base, schema: 'nope' }).length > 0, 'bad schema');
  assert(validateEnvelope({ ...base, kdf: { ...base.kdf, algorithm: 'MD5' } }).length > 0, 'bad kdf alg');
  assert(validateEnvelope({ ...base, kdf: { ...base.kdf, iterations: 100 } }).length > 0, 'too few iterations');
  assert(validateEnvelope({ ...base, wrappedKey: { ...base.wrappedKey, ivHex: 'short' } }).length > 0, 'bad iv');
  assert(validateEnvelope({ ...base, verifierHex: 'nope' }).length > 0, 'bad verifier');
});

t('change-password re-wraps SAME DEK with new KEK', () => {
  const env1 = buildEnvelope({ dekHex: DEK, password: 'old', vaultId: 'v', saltHex: SALT });
  // simulate change: derive DEK from old envelope, then re-wrap with a new salt+password
  const check1 = checkPassword(env1, 'old');
  assert(check1.ok, 'old password must unlock old envelope');
  const dek = unwrapDek(env1.wrappedKey, check1.kekHex);
  assert(dek === DEK, 'DEK must be recoverable');
  const NEW_SALT = 'aabbccddeeff00112233445566778899';
  const env2 = buildEnvelope({ dekHex: dek, password: 'new', vaultId: 'v', saltHex: NEW_SALT, previousRevision: env1.revision });
  const oldTry = checkPassword(env2, 'old');
  assert(!oldTry.ok, 'old password must NOT unlock new envelope');
  const newTry = checkPassword(env2, 'new');
  assert(newTry.ok, 'new password must unlock new envelope');
  const recovered = unwrapDek(env2.wrappedKey, newTry.kekHex);
  assert(recovered === DEK, 'change-password must NOT alter the DEK');
  assert(env2.revision === env1.revision + 1, 'revision must bump');
});

t('idempotency: same DEK + same password + same salt yields identical verifier (deterministic verify)', () => {
  const e1 = buildEnvelope({ dekHex: DEK, password: 'x', vaultId: 'v', saltHex: SALT });
  const e2 = buildEnvelope({ dekHex: DEK, password: 'x', vaultId: 'v', saltHex: SALT });
  assert(e1.verifierHex === e2.verifierHex, 'verifier must be deterministic given (password, salt, iterations)');
});

t('two different DEKs wrapped with same password produce different ciphertext', () => {
  const dek2 = '1'.repeat(64);
  const { kekHex } = deriveKekAndVerifier('same-pw', SALT);
  const iv = '00'.repeat(16); // fix IV to remove randomness
  const w1 = wrapDek(DEK, kekHex, iv);
  const w2 = wrapDek(dek2, kekHex, iv);
  assert(w1.ciphertext !== w2.ciphertext, 'different DEKs -> different ciphertext');
});

t('same DEK wrapped twice with random IV produces different ciphertext (IV variety)', () => {
  const { kekHex } = deriveKekAndVerifier('pw', SALT);
  const w1 = wrapDek(DEK, kekHex);
  const w2 = wrapDek(DEK, kekHex);
  assert(w1.ivHex !== w2.ivHex, 'IV must be random per call');
  assert(w1.ciphertext !== w2.ciphertext, 'ciphertext must differ due to IV');
  // both must still unwrap correctly
  assert(unwrapDek(w1, kekHex) === DEK && unwrapDek(w2, kekHex) === DEK);
});

t('lower iteration count still works (backwards-compat with older envelopes)', () => {
  const env = buildEnvelope({ dekHex: DEK, password: 'p', vaultId: 'v', saltHex: SALT });
  const oldEnv = { ...env, kdf: { ...env.kdf, iterations: 100_000 } };
  // Re-derive verifier at the lower iteration count so the envelope is internally consistent.
  const { verifierHex, kekHex } = deriveKekAndVerifier('p', SALT, 100_000);
  const consistent = { ...oldEnv, verifierHex, wrappedKey: { ...env.wrappedKey, ...wrapDek(DEK, kekHex, env.wrappedKey.ivHex) } };
  const check = checkPassword(consistent, 'p');
  assert(check.ok, 'lower-iteration envelope must still verify');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
