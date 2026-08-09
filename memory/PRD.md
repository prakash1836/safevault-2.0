# SafeVault — PRD

## Sprint 3 — Product Experience Enhancement (2026-01)
Preserve architecture; enhance onboarding, storage understanding, recovery
awareness and document accessibility. All prior work in place.

### Delivered
- New stepper onboarding (Welcome → Details → Security → Storage → Drive →
  Encryption → Pricing → Permissions).
- Recovery Password service (`services/recoveryPassword.ts`) — SecureStore-only,
  future-proof interface (`deriveWrappingKey` hook stubbed).
- Storage-mode preference + per-document `storageMode` field.
- New Upload Wizard "Storage Type" step between Upload and Details.
- `UploadCoordinator` branches on storage mode; adds `local-only` terminal state.
- Storage & Security settings page (`/settings/storage-security`).
- Original + Encrypted export from document detail via bottom sheet.
- Full-screen `DocumentProgressOverlay` (Preparing → Downloading → Decrypting → Opening).
- Trust messaging (`TrustBadges`, `InfoSheet`) reused across onboarding + settings.

### Untouched (per instructions)
- `UploadCoordinator` retry/backoff loop, queue engine.
- `MetadataManager`, `FolderManager`, `SyncManager` architecture.
- Encryption (`services/encryption.ts`) — key derivation unchanged.
- SQLite schema (only additive optional `storageMode` field on VaultDocument).
- Reminders, notifications, existing tests, existing testIDs.
- Existing `.github/workflows/android.yml` and `.github/workflows/android-debug.yml`.

### Placeholders — deferred to future sprints
- Biometric Unlock (persists as UX toggle only; needs `expo-local-authentication`).
- Auto Lock timer (persists; will activate with biometrics).
- Export Recovery Kit (UI button opens explainer sheet).
- Emergency Recovery (UI button opens explainer sheet).
- Change Recovery Password full flow (button opens explainer sheet).
- Recovery-driven multi-device (`deriveWrappingKey` stubbed, throws until wired).
- Pricing purchases (Free / Premium / Family cards render, purchase not wired).

## Sprint 4 — Recovery Foundation (2026-01)

### Cryptographic architecture
Recovery Password → PBKDF2-SHA256(210 000) → 64 bytes → split into KEK (bytes 0..32) + Verifier (bytes 32..64).
KEK wraps the *existing* DEK with AES-256-CBC + random IV. Wrapped result + verifier + KDF params stored as plain JSON at `SafeVault/manifest/recovery.json`. The DEK itself is never changed → existing ciphertext remains readable.

### Files added
- `src/services/recovery.ts` — envelope build/save/load, wrap/unwrap, setup, restore, change-password. Idempotent, side-effect-free on wrong password.
- `app/recovery/setup.tsx` — set-up screen.
- `app/recovery/restore.tsx` — new-device restore screen.
- `app/recovery/change.tsx` — change-password screen.
- `__tests__/recovery.test.mjs` — 15 pure-crypto unit tests.
- `docs/RECOVERY.md` — full architectural write-up.

### Files modified
- `app/_layout.tsx` — registered 3 recovery routes.
- `app/login.tsx` — "Restore from Google Drive" entry.
- `app/settings/storage-security.tsx` — real recovery status badge, real "Set Up Recovery" / "Change Recovery Password" / "Recovery information" rows.

### Placeholders deferred
- Export Recovery Kit (PDF)
- Emergency Recovery (Shamir-shared secret)
- Biometric Unlock + Auto Lock
- Rate-limit on wrong password

## Sprint 5 — Recovery Hardening & Restore UX (2026-01)

### Security review outcome
- Confirmed: DEK is unrecoverable without the password (attack #2 impossible).
- Confirmed: chosen-DEK install requires knowing the user's password (attack #3 impossible).
- DoS attacks (garbage-DEK swap, rollback to old backup) noted as low-severity residual; envelope MAC deferred to a follow-up sprint.
- No changes to existing document encryption or existing DEK.

### Implemented
1. **Restore progress**: after successful unlock, MetadataManager.load runs with staged UI progress (`Loading vault index… → Downloading manifest… → Loaded N documents`). Restore screen ends with the actual document count.
2. **Rate-limit**: exponential backoff 30s → 2m → 10m → 1h → 24h after attempts 4→8+. Persisted per-vault in SecureStore. Countdown UI on the restore screen. Cleared on successful unlock.
3. **Cross-device change detection**: RecoveryChangeWatcher tracks last-seen revision. Banner in Storage & Security when Drive envelope is newer than last-seen; tapping routes to Restore to re-verify.

### Files added
- src/services/recoveryRateLimit.ts
- src/services/recoveryChangeWatcher.ts
- __tests__/recoveryRateLimit.test.mjs (14 tests, all pass)

### Files modified
- src/services/recovery.ts — added fetchEnvelopeMetadata (cheap metadata-only Drive call).
- app/recovery/restore.tsx — new `locked` and `restoring` phases; LockoutCountdown; rate-limit hooks; MetadataManager.load with progress; RecoveryChangeWatcher acknowledgement on success.
- app/recovery/setup.tsx — acknowledge revision baseline after successful setup.
- app/recovery/change.tsx — re-anchor revision baseline after password change.
- app/settings/storage-security.tsx — cross-device change banner + isChanged check.

### Verification (testing_agent iteration_12)
- 52/52 unit tests pass across 6 test files.
- npx tsc --noEmit → 0 errors.
- npx expo export --platform web → 25 routes, all 4 required recovery routes present.
- Testing agent: retest_needed=false, action_items=[], no issues raised.

### Deferred / documented limitations
- AES-CBC → AES-GCM migration for envelope (schema-v2 with MAC) — future sprint.
- Rollback attack (attacker swaps recovery.json with old recovery.bak) — future rev-forward-only enforcement.
- Real-device restore over Drive — requires Google Sign-In, not automatable in this container.

## Sprint 6 — Recovery Security Finalization (2026-01)

### Schema-v2 design
- PBKDF2 output extended from 64 to 96 bytes → KEK(0..32) + Verifier(32..64) + MAC_KEY(64..96).
- First 64 bytes bit-identical to v1 → deterministic migration.
- HMAC-SHA256 over canonical `|`-separated input covering schema, vaultId, revision, kdf.{alg,iters,saltHex,outputBytes}, wrappedKey.{alg,ivHex,ciphertext}, verifierHex. createdAt/updatedAt excluded (not security-relevant).
- Constant-time MAC compare via `constantTimeEqualHex`.

### Verification pipeline (invariant)
validate → PBKDF2 → verifier compare → HMAC constant-time compare → AES unwrap → 32-byte DEK sanity → install. Any earlier failure → DEK untouched, Drive untouched.

### v1 → v2 migration
Same salt/iters → same first 64 bytes → same KEK/verifier/wrappedKey preserved verbatim. Only MAC field is added. createdAt/updatedAt/revision all preserved. Crash-safe: if the v2 upload fails, v1 remains at `recovery.json` and next restore retries.

### Rollback protection
Version-neutral key `safevault.recovery.highest.revision.<vaultId>` in SecureStore. `checkRollback` rejects envelope.revision < localHigh. Updated ONLY after full verification.

### Files changed
- Rewritten: src/services/recovery.ts (743 lines)
- Updated: app/recovery/restore.tsx (handle 'tampered' and 'rollback' reasons)
- Updated: app/recovery/change.tsx (handle 'tampered')
- Added: __tests__/recoveryV2.test.mjs (30 tests)
- Added: docs/QA_RECOVERY.md (physical-device checklist, not executed here)

### Test results (verified by testing_agent iteration_13)
- 82 unit tests pass, 0 failed across 7 files
- tsc --noEmit: 0 errors
- Metro/Expo export: 25 routes, all recovery routes present

### Physical-device QA
- NOT executed in this container (no Android, no real Drive account)
- Checklist prepared at docs/QA_RECOVERY.md with 30+ steps covering: Device A vault setup, Device B new-device restore, wrong password, lockout ladder, network off, corrupted primary + backup, tampered MAC, rollback, cross-device change detection, multi-device sync, and DEK preservation across password change

### Remaining limitations
- New-device rollback: fresh install has no localHigh → relies on MAC + password. Documented.
- AES-CBC on documents remains (envelope is now authenticated; document ciphertext migration deferred as it requires re-encrypting all docs).
