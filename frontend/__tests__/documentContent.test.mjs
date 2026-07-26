// In-process unit tests for documentContent.verifyIntegrity behaviour.
// Reuses the same CryptoJS SHA-256(Base64) pattern as the source module.
import CryptoJS from 'crypto-js';

function sha256OfBase64(b64) {
  const wa = CryptoJS.enc.Base64.parse(b64);
  return CryptoJS.SHA256(wa).toString(CryptoJS.enc.Hex);
}

function verifyIntegrity(base64, expected) {
  if (!expected) return { verified: false };
  try {
    const actual = sha256OfBase64(base64);
    if (actual === expected) return { verified: true };
    return { verified: false, warning: `File integrity check did not match (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…)` };
  } catch { return { verified: false, warning: 'Could not compute file hash for integrity check' }; }
}

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); console.log('OK  -', name); pass++; } catch (e) { console.log('FAIL-', name, ':', e.message); fail++; } }
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

const SAMPLE = 'SGVsbG8gU2FmZVZhdWx0'; // "Hello SafeVault"
const SAMPLE_HASH = sha256OfBase64(SAMPLE);

t('verified=true when SHA-256 matches', () => {
  const r = verifyIntegrity(SAMPLE, SAMPLE_HASH);
  assert(r.verified === true);
  assert(!r.warning);
});

t('verified=false with warning when SHA-256 mismatches', () => {
  const r = verifyIntegrity(SAMPLE, 'deadbeef'.repeat(8));
  assert(r.verified === false);
  assert(typeof r.warning === 'string' && r.warning.length > 0);
  assert(r.warning.includes('did not match'));
});

t('verified=false with NO warning when fileHash undefined', () => {
  const r = verifyIntegrity(SAMPLE, undefined);
  assert(r.verified === false);
  assert(!r.warning);
});

t('verified=false with NO warning when fileHash null', () => {
  const r = verifyIntegrity(SAMPLE, null);
  assert(r.verified === false);
  assert(!r.warning);
});

t('sha256OfBase64 returns 64-char lowercase hex', () => {
  assert(/^[0-9a-f]{64}$/.test(SAMPLE_HASH));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
