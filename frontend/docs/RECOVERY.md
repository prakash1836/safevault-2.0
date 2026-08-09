# SafeVault — Recovery Foundation

Sprint: Recovery Foundation (2026-01)

## TL;DR

SafeVault's existing DEK stays exactly as it is. To make it recoverable we
wrap it with a KEK derived from the user's Recovery Password and upload the
wrapped result to Drive. A new device can now sign in with the same Google
account, download the envelope, derive the KEK from the password, unwrap the
DEK, and gain access to every already-uploaded document verbatim.

```
┌──────────────────────────────────────────────────────────────────┐
│  Recovery Password (never persisted in plaintext)                │
│           │                                                      │
│           ▼   PBKDF2-SHA256, 210 000 iterations, saltR           │
│           │   ─── 64 bytes ───                                   │
│           ├── KEK (bytes 0..32) ─ AES-256-CBC wrap ─┐            │
│           └── VERIFIER (bytes 32..64) ─────────┐    │            │
│                                                │    ▼            │
│  DEK (existing, unchanged)                     │  wrapped DEK    │
│  = PBKDF2(userId, device-salt, 10k)           │                 │
│                                                │    │            │
│                                                ▼    ▼            │
│  Drive: SafeVault/manifest/recovery.json (plain-JSON envelope)   │
│    { schema, vaultId, kdf{alg,iters,saltR},                      │
│      wrappedKey{alg,iv,ct}, verifierHex, revision, timestamps }  │
└──────────────────────────────────────────────────────────────────┘
```

## Guarantees

- **Zero-knowledge preserved.** The Recovery Password never leaves the device.
  Only wrapped ciphertext + KDF params + public verifier land in Drive.
- **Existing ciphertext is unchanged.** We never touch the DEK, so every
  document and manifest encrypted before this sprint remains decryptable.
- **Wrong password ≠ side effect.** `checkPassword()` compares the verifier
  hex BEFORE invoking AES. Wrong ⇒ short-circuit with `reason: 'wrong-password'`.
  Neither Drive nor SecureStore is modified.
- **Idempotent.** `setupRecovery()` re-runs safely: if an envelope already
  exists AND the password unwraps to the SAME device DEK, we set the local
  flag and return `alreadySetUp: true`. If the envelope wraps a DIFFERENT
  key/password (e.g. change-password happened on another device), we throw
  `RecoveryEnvelopeConflictError` — callers route to `changeRecoveryPassword`.
- **Backup rotated on every save.** Same pattern as `metadata.json` →
  `metadata.bak`, so a corrupted envelope has a warm fallback.

## What is stored where

| Where | What | Encrypted with |
|-------|------|----------------|
| SecureStore `safevault.enc.key.v1` | DEK hex | OS keystore |
| SecureStore `safevault.recovery.hash.v1` | PBKDF2 hash of password | OS keystore |
| SecureStore `safevault.recovery.setup.v1` | `"1"` flag | OS keystore |
| Drive `SafeVault/manifest/recovery.json` | Envelope JSON (KDF params + wrapped DEK + verifier) | The DEK inside is wrapped by the KEK. Envelope wrapper is plaintext JSON on purpose (new devices need to read it before they have any key). |
| Drive `SafeVault/manifest/recovery.bak` | Previous envelope | Same |
| Drive `SafeVault/manifest/metadata.json` | Existing manifest — unchanged | DEK (as before) |
| Drive `SafeVault/docs/**/*.enc` | Existing documents — unchanged | DEK (as before) |

## What is NOT stored anywhere

- The Recovery Password itself (only a PBKDF2 hash + salt on-device).
- The unwrapped DEK outside SecureStore.
- Any plaintext document.

## New-device restore flow

1. Sign in with Google (drive.file scope).
2. `Recovery.fetchEnvelope(user)` → look for `SafeVault/manifest/recovery.json`.
3. If missing → "No vault found on this account."
4. If found → prompt for password.
5. `Recovery.checkPassword(env, pw)` — verifier equality only. Wrong ⇒
   friendly error, no side effect.
6. Right ⇒ `Recovery.unwrapDek(env.wrappedKey, kek)` → DEK hex.
7. `secureStore.set('safevault.enc.key.v1', dekHex)`.
8. Existing `MetadataManager.load()` now succeeds (it uses the DEK to decrypt
   `metadata.json`). `SyncManager`-adjacent code populates SQLite on demand.
9. Documents remain lazy-loaded from Drive by `documentContent.ts`.

## Existing-user migration

Existing users on `beforeappdevelopment` already have:
- A DEK in `secureStore.enc.key.v1`.
- A recovery-password hash in `secureStore.recovery.hash.v1` (from Sprint 3).

Migration:
1. User taps *Set Up Recovery* in Storage & Security.
2. Screen prompts for the same password (or a new one if none was set).
3. `Recovery.setupRecovery()` derives KEK, wraps the *existing* DEK, uploads
   the envelope. All previously-uploaded ciphertext remains decryptable.

## Change-password

`Recovery.changeRecoveryPassword(user, old, new)`:
1. Fetch envelope.
2. Verify `old` against envelope's verifier (no AES yet).
3. Wrong ⇒ `wrong-password`, envelope untouched.
4. Right ⇒ unwrap DEK using old KEK.
5. Build a *new* envelope wrapping the *same* DEK with a KEK derived from
   `new` + a *fresh* salt.
6. Upload (rotates old primary into `recovery.bak`).

Since the DEK is unchanged, other devices that already restored this vault
continue to work with their locally-cached DEK. They will only need the new
password if they ever restore again from scratch.

## Multi-device

After Device B restores successfully:
- Device B holds the same DEK hex as Device A.
- Device B writes ciphertext to the same Drive paths using the same key.
- `MetadataManager`, `FolderManager`, `SyncManager` behave identically — they
  never knew about recovery.

## Local-only documents

By definition (`storageMode === 'local'`), these were never uploaded to Drive.
Recovery cannot fabricate them. The Restore screen explicitly says so:

> "Documents your previous device stored in Local Vault only were never
> uploaded and cannot be recovered from Drive."

## Failure modes handled

| Case | Behaviour |
|------|-----------|
| Google account not connected | Restore screen phase `connecting` → user connects |
| SafeVault folder not found | `FolderManager` creates it on demand; envelope search returns `null` → `not-found` |
| Recovery envelope not found | Restore screen phase `not-found` |
| Corrupted primary envelope | `fetchEnvelope` falls back to `recovery.bak` |
| Both primary AND backup corrupted | `RecoveryEnvelopeCorruptedError` → screen phase `corrupted` |
| Wrong password | Verifier mismatch → `wrong-password`, no I/O |
| Manifest corruption after unwrap | Handled by existing `MetadataManager.ManifestCorruptedError` |
| Drive unavailable | `fetchEnvelope` throws → screen phase `no-drive` |
| Interrupted setup | Idempotent: re-run detects existing envelope + verifies with same password |
| Existing device has a vault | `RecoveryEnvelopeConflictError` on conflicting envelope → user routes to change-password |

## Cryptographic risks documented

- **PBKDF2-SHA256 @ 210 000** is not Argon2id but is what `crypto-js` provides
  without adding native deps. ~1 s on midrange Android — acceptable for
  setup/restore (rare).
- **AES-CBC without HMAC** — CBC is not authenticated. We mitigate:
  - Verifier compare BEFORE decryption catches wrong password (no oracle).
  - Malformed unwrap output length is rejected (must be 32 bytes).
  - Drive `appProperties['safevault.hash']` supplies best-effort tamper
    detection for the envelope shell.
- **No rate-limit** on wrong-password attempts. PBKDF2 iterations impose a
  ~1 s natural throttle, but a follow-up sprint can add an exponential backoff.
- **Recovery envelope is not app-encrypted.** Intentional — a new device
  without a DEK must be able to read it. The DEK inside IS wrapped.

## Testing

- Pure-crypto unit tests: `__tests__/recovery.test.mjs` (15 cases, all pass).
- Integration tests deferred (would require a real Drive account); production
  E2E is manual for now.

## Deferred (kept as clearly-marked placeholders)

- Export Recovery Kit (PDF)
- Emergency Recovery (Shamir-shared secret with trusted contact)
- Biometric Unlock + Auto Lock
- Rate-limiting on wrong-password attempts
