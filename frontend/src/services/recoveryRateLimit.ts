// Recovery rate-limit — exponential backoff after repeated failed attempts.
//
// Design:
//   • Attempts 1, 2, 3          → no lockout (PBKDF2 ~1s each is the natural throttle).
//   • Attempts 4+                → progressively longer wait windows.
//   • State is scoped BY VAULT ID (envelope.vaultId) so a fresh restore of a
//     different vault on the same device isn't punished.
//   • Persisted in SecureStore under a per-vault key so uninstall wipes it
//     (uninstall already resets everything else recovery-related).
//   • Successful restore or successful setup clears the counter.
//
// Backoff schedule (attempt = the wrong-password attempt count, 1-indexed):
//
//   attempts 1..3   → 0 ms
//   attempt   4     → 30 s
//   attempt   5     → 2 min
//   attempt   6     → 10 min
//   attempt   7     → 1 hour
//   attempt   ≥ 8   → 24 hours (capped)

import { secureStore } from './encryption';

const KEY_PREFIX = 'safevault.recovery.attempts.v1.';

export interface AttemptState {
  vaultId: string;
  count: number;                // total wrong-password attempts since last success
  firstFailedAt: string;        // ISO — cosmetic only, for the UI
  lockedUntil: string | null;   // ISO — null when not currently locked
}

/** Backoff table. Deterministic → easy to unit-test. */
export function lockoutMsFor(attempt: number): number {
  if (attempt <= 3) return 0;
  if (attempt === 4) return 30 * 1000;
  if (attempt === 5) return 2 * 60 * 1000;
  if (attempt === 6) return 10 * 60 * 1000;
  if (attempt === 7) return 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function keyFor(vaultId: string): string { return KEY_PREFIX + vaultId; }

function nowIso(): string { return new Date().toISOString(); }
function nowMs(): number { return Date.now(); }

async function read(vaultId: string): Promise<AttemptState | null> {
  const raw = await secureStore.get(keyFor(vaultId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as AttemptState;
  } catch { return null; }
}

async function write(state: AttemptState): Promise<void> {
  await secureStore.set(keyFor(state.vaultId), JSON.stringify(state));
}

async function del(vaultId: string): Promise<void> {
  await secureStore.del(keyFor(vaultId));
}

export interface LockoutStatus {
  locked: boolean;
  remainingMs: number;    // 0 if not locked
  attempts: number;       // current failure count
  nextLockoutMs: number;  // what the NEXT failure would incur
}

/**
 * Inspect current lockout status for a given vault. Cheap; no writes.
 */
export async function getStatus(vaultId: string): Promise<LockoutStatus> {
  const st = await read(vaultId);
  if (!st) return { locked: false, remainingMs: 0, attempts: 0, nextLockoutMs: lockoutMsFor(1) };
  const remaining = st.lockedUntil ? Math.max(0, new Date(st.lockedUntil).getTime() - nowMs()) : 0;
  return {
    locked: remaining > 0,
    remainingMs: remaining,
    attempts: st.count,
    nextLockoutMs: lockoutMsFor(st.count + 1),
  };
}

/**
 * Record a wrong-password attempt for the given vault. Updates the persisted
 * lockout window using the backoff table.
 */
export async function recordFailure(vaultId: string): Promise<LockoutStatus> {
  const prev = await read(vaultId);
  const count = (prev?.count || 0) + 1;
  const ms = lockoutMsFor(count);
  const lockedUntil = ms > 0 ? new Date(nowMs() + ms).toISOString() : null;
  const state: AttemptState = {
    vaultId,
    count,
    firstFailedAt: prev?.firstFailedAt || nowIso(),
    lockedUntil,
  };
  await write(state);
  return {
    locked: !!lockedUntil,
    remainingMs: ms,
    attempts: count,
    nextLockoutMs: lockoutMsFor(count + 1),
  };
}

/**
 * Clear the counter — call on successful restore, successful setup, or when
 * the user has legitimately regained access.
 */
export async function recordSuccess(vaultId: string): Promise<void> {
  await del(vaultId);
}

/** Force a reset. Used only in dev tooling / factory reset. */
export async function reset(vaultId: string): Promise<void> {
  await del(vaultId);
}

export const RecoveryRateLimit = {
  lockoutMsFor,
  getStatus,
  recordFailure,
  recordSuccess,
  reset,
};
