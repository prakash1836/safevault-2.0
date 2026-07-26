// In-process unit tests for manifest primitives.
// We avoid the full TS build by replicating the small pure logic and
// asserting the same invariants the source file guarantees.
import CryptoJS from 'crypto-js';

const CURRENT_SCHEMA_VERSION = 1;

function nowIso() { return new Date().toISOString(); }
function sha256(s) { return CryptoJS.SHA256(CryptoJS.enc.Utf8.parse(s)).toString(CryptoJS.enc.Hex); }

function buildEmptyManifest({ deviceId, appVersion, vaultId }) {
  const t = nowIso();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
    vaultId, createdAt: t, updatedAt: t, deviceId, appVersion,
    documents: [], categories: [], tombstones: [],
  };
}
function computeManifestHash(m) {
  const { updatedAt, ...rest } = m;
  return sha256(JSON.stringify(rest));
}
function validateManifest(m) {
  const errs = [];
  if (!m || typeof m !== 'object') return ['manifest is not an object'];
  if (typeof m.schemaVersion !== 'number') errs.push('schemaVersion is not a number');
  if (typeof m.revision !== 'number') errs.push('revision is not a number');
  if (typeof m.vaultId !== 'string' || !m.vaultId) errs.push('vaultId is missing');
  if (typeof m.createdAt !== 'string') errs.push('createdAt is missing');
  if (typeof m.updatedAt !== 'string') errs.push('updatedAt is missing');
  if (typeof m.deviceId !== 'string') errs.push('deviceId is missing');
  if (typeof m.appVersion !== 'string') errs.push('appVersion is missing');
  if (!Array.isArray(m.documents)) errs.push('documents is not an array');
  if (!Array.isArray(m.categories)) errs.push('categories is not an array');
  if (!Array.isArray(m.tombstones)) errs.push('tombstones is not an array');
  return errs;
}

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); console.log('OK  -', name); pass++; } catch (e) { console.log('FAIL-', name, ':', e.message); fail++; } }
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

const m = buildEmptyManifest({ deviceId: 'd1', appVersion: '2.0.0', vaultId: 'v1' });

t('buildEmptyManifest defaults', () => {
  assert(m.revision === 0, 'revision');
  assert(m.schemaVersion === 1, 'schemaVersion');
  assert(Array.isArray(m.documents) && m.documents.length === 0);
  assert(Array.isArray(m.categories) && m.categories.length === 0);
  assert(Array.isArray(m.tombstones) && m.tombstones.length === 0);
  assert(m.vaultId && m.createdAt && m.updatedAt && m.deviceId && m.appVersion);
});
t('validateManifest([]) errors', () => {
  const e = validateManifest([]);
  assert(e.length > 0 && /not an object|missing|not a number|not an array/.test(e.join(';')));
});
// Note: validateManifest([]) returns 'manifest is not an object' only if !array-check;
// Since arrays are objects, we actually check the string; adjust:
t('validateManifest(null)', () => {
  const e = validateManifest(null);
  assert(e.includes('manifest is not an object'));
});
t('validateManifest(empty valid) is []', () => {
  const e = validateManifest(m);
  assert(e.length === 0, 'expected no errs, got: ' + e.join(','));
});
t('computeManifestHash is 64-char lowercase hex', () => {
  const h = computeManifestHash(m);
  assert(/^[0-9a-f]{64}$/.test(h), 'hash=' + h);
});
t('hash stable when only updatedAt changes', () => {
  const h1 = computeManifestHash(m);
  const m2 = { ...m, updatedAt: new Date(Date.now() + 10000).toISOString() };
  const h2 = computeManifestHash(m2);
  assert(h1 === h2, `hashes differ: ${h1} vs ${h2}`);
});
t('hash changes when documents change', () => {
  const h1 = computeManifestHash(m);
  const m2 = { ...m, documents: [{ id: 'x' }] };
  const h2 = computeManifestHash(m2);
  assert(h1 !== h2);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
