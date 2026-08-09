// In-process tests for the recovery rate-limit + change-watcher logic.
// Replicates the pure logic (backoff table, isChanged) so we can validate
// without pulling in SecureStore or AsyncStorage.

function lockoutMsFor(attempt) {
  if (attempt <= 3) return 0;
  if (attempt === 4) return 30 * 1000;
  if (attempt === 5) return 2 * 60 * 1000;
  if (attempt === 6) return 10 * 60 * 1000;
  if (attempt === 7) return 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function isChanged(lastSeen, current) {
  if (!current) return false;
  if (!lastSeen) return false;
  if (current.revision > lastSeen.revision) return true;
  if (current.revision === lastSeen.revision && current.updatedAt !== lastSeen.updatedAt) return true;
  return false;
}

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); console.log('OK  -', name); pass++; } catch (e) { console.log('FAIL-', name, ':', e.message); fail++; } }
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

// --------------- lockoutMsFor -----------------
t('attempts 1..3 → no lockout', () => {
  assert(lockoutMsFor(1) === 0);
  assert(lockoutMsFor(2) === 0);
  assert(lockoutMsFor(3) === 0);
});
t('attempt 4 → 30 seconds', () => {
  assert(lockoutMsFor(4) === 30 * 1000, `got ${lockoutMsFor(4)}`);
});
t('attempt 5 → 2 minutes', () => {
  assert(lockoutMsFor(5) === 2 * 60 * 1000);
});
t('attempt 6 → 10 minutes', () => {
  assert(lockoutMsFor(6) === 10 * 60 * 1000);
});
t('attempt 7 → 1 hour', () => {
  assert(lockoutMsFor(7) === 60 * 60 * 1000);
});
t('attempts ≥ 8 → 24 hours (capped)', () => {
  assert(lockoutMsFor(8) === 24 * 60 * 60 * 1000);
  assert(lockoutMsFor(9) === 24 * 60 * 60 * 1000);
  assert(lockoutMsFor(100) === 24 * 60 * 60 * 1000);
});
t('backoff is strictly monotonic from attempt 4 onward', () => {
  for (let i = 4; i < 8; i++) {
    assert(lockoutMsFor(i) < lockoutMsFor(i + 1), `not monotonic at ${i}: ${lockoutMsFor(i)} vs ${lockoutMsFor(i+1)}`);
  }
});

// --------------- isChanged -----------------
t('no last-seen → not changed (first look)', () => {
  const r = isChanged(null, { revision: 5, updatedAt: '2026-01-01T00:00:00Z' });
  assert(r === false);
});
t('no current envelope → not changed', () => {
  const r = isChanged({ vaultId: 'v', revision: 5, updatedAt: 'a', seenAt: 'b' }, null);
  assert(r === false);
});
t('drive revision higher → changed', () => {
  const r = isChanged(
    { vaultId: 'v', revision: 3, updatedAt: '2026-01-01T00:00:00Z', seenAt: 'x' },
    { revision: 4, updatedAt: '2026-01-02T00:00:00Z' },
  );
  assert(r === true);
});
t('same revision + same updatedAt → not changed', () => {
  const r = isChanged(
    { vaultId: 'v', revision: 3, updatedAt: '2026-01-01T00:00:00Z', seenAt: 'x' },
    { revision: 3, updatedAt: '2026-01-01T00:00:00Z' },
  );
  assert(r === false);
});
t('same revision + different updatedAt → changed (defensive)', () => {
  const r = isChanged(
    { vaultId: 'v', revision: 3, updatedAt: '2026-01-01T00:00:00Z', seenAt: 'x' },
    { revision: 3, updatedAt: '2026-01-02T00:00:00Z' },
  );
  assert(r === true);
});
t('drive revision LOWER than last-seen → not changed (rollback ignored by watcher; caller handles)', () => {
  // The watcher only surfaces forward-moving diffs. Rollback attacks are a separate
  // concern flagged in the security review.
  const r = isChanged(
    { vaultId: 'v', revision: 5, updatedAt: '2026-01-05T00:00:00Z', seenAt: 'x' },
    { revision: 4, updatedAt: '2026-01-04T00:00:00Z' },
  );
  assert(r === false);
});

// --------------- state-machine-style simulation -----------------
t('simulated 8 wrong attempts: total delay never exceeds sum(cap=24h)', () => {
  let total = 0;
  for (let i = 1; i <= 8; i++) total += lockoutMsFor(i);
  // 0+0+0+30s+2m+10m+1h+24h = 25h 42m 30s = 92 550 000 ms
  assert(total === 30000 + 120000 + 600000 + 3600000 + 86400000, `got ${total}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
