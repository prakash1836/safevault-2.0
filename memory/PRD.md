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
