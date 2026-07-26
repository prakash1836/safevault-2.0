# SafeVault — Product Requirements Document

## Original Problem Statement
Refine the existing SafeVault React Native (Expo + TypeScript) mobile app to a polished, premium-quality experience — like something built by Google, Notion, Apple, or Dropbox — without changing the navigation flow, architecture, or business logic. After the refinement was approved, deliver Phase 1 MVP features (Document Upload, Document Library, Reminder System) with the same "no redesign, no architectural change" discipline.

## User Choices Captured
- Codebase access: use existing code in `/app`
- Design direction: "You decide" — premium mobile aesthetic
- Color palette: **Trust Blue** as default (theme selector remains for user to change later)
- Logo: SVG-based

Phase 1 adjustments:
- Task 1 — Reminder storage key `safevault.notifications.map.v1`; default fire time 09:00 local; UI-neutral.
- Task 2 — Configurable `MAX_UPLOAD_SIZE_MB = 50`; add `uploadProgress` to VaultContext; retry supported; keep extensible for resumable uploads (`RESUMABLE_UPLOAD_THRESHOLD_BYTES` reserved).
- Task 3 — Sort by Name / Date Added / Recently Modified / Expiry Date; duplicate detection via SHA-256 file hash (fallback: name + size); warning is **non-blocking**.

## Personas
- **First-time users** who need document security they can trust at a glance
- **Family administrators** managing IDs, insurance, and expiring documents for multiple people
- **Returning users** who rely on reminders to avoid missed renewals

## Architecture (unchanged)
- Expo Router file-based navigation
- Contexts: Auth, Vault, Upload, Theme (runtime preset + custom hex), Permissions
- Client-side AES-256 encryption before Google Drive upload (drive.file scope)
- MongoDB backend (present, minimal use for the mobile MVP)
- Reanimated 3 + Haptics for micro-interactions

## Core Requirements (Static)
- Never change navigation flow, screen names, feature names, or business logic
- Preserve Google Drive integration & authentication (Google Sign-In + demo mode)
- Every interactive element has `testID`
- Splash under 3 seconds
- Theme is user-changeable at any time

## What's Been Implemented (Jan/Jul 2026)

### UI Refinement (Complete)
- `UX_REPORT.md` — full analysis
- `src/components/Logo.tsx` — new SVG SafeVault brandmark
- `app/index.tsx` — animated splash (~1.6s)
- Trust Blue premium theme as default; user can still switch
- Login, onboarding, tab bar, home dashboard, upload wizard all polished; no redesign

### Bug Fixes (Complete)
- `AuthContext.tsx` — SignInResponse discriminated-union narrowing for `@react-native-google-signin/google-signin` v16
- `VaultContext.tsx` — reminder ID map persisted at `safevault.notifications.map.v1`; re-scheduled on `updateDoc`; default fire hour = 9:00 local

### Phase 1 — Document Upload / Library / Reminders (Complete)

**Task 1 — Reminder System hardening** ✅ verified (`iteration_5.json` 100%)
- `services/notifications.ts` — exported `DEFAULT_REMINDER_HOUR = 9`; `scheduleReminders` accepts optional `atHour`; every reminder normalised to that local hour via `date-fns setHours/setMinutes/setSeconds/setMilliseconds`.
- `services/storage.ts` — new `NOTIF_MAP` key `safevault.notifications.map.v1`; `getReminderMap()` / `setReminderMap()`.
- `contexts/VaultContext.tsx` — `hydrateReminderStore()`, `persistReminderStore()`, `setRemindersFor()`, `clearRemindersFor()` helpers. `updateDoc` now detects `expiryDate`, `reminder.*`, or `name` change and re-schedules.

**Task 2 — Document Upload progress + guardrails** ✅ verified (`iteration_6.json` 100%)
- `constants/upload.ts` — `MAX_UPLOAD_SIZE_MB = 50`, `MAX_UPLOAD_SIZE_BYTES`, `RESUMABLE_UPLOAD_THRESHOLD_BYTES` (reserved for future resumable engine).
- `services/drive.ts` — `UploadOptions { onProgress?, signal? }`; `uploadToDrive` uses `XMLHttpRequest.upload.onprogress` when available, falls back to `fetch`. Demo/anonymous path also emits 0→1 progress ticks.
- `contexts/VaultContext.tsx` — `uploadProgress: number` exposed; reset to 0 on start; wired via `onProgress` callback.
- `app/upload/file.tsx` — both `pickAnyFile` and `pickImage` reject over-limit files with a friendly Alert citing actual MB and the limit.
- `app/upload/review.tsx` — additive progress box (testIDs `review-progress-box`, `review-progress-pct`); button label switches to `Uploading… NN%` while active and `Retry upload` after failure.

**Task 3 — Document Library polish** ✅ verified (`iteration_8.json` 100% after fixing 2 items in `iteration_7`)
- `types/index.ts` — `VaultDocument.fileHash?: string`.
- `contexts/UploadContext.tsx` — `UploadDraft.fileHash: string | null`.
- `app/upload/file.tsx` — `sha256OfBase64` helper; all three pickers (`pickAnyFile`, `pickImage`, `useSample`) populate `fileHash` in the draft.
- `contexts/VaultContext.tsx` — `addDoc` persists `fileHash` on the new document.
- `app/upload/review.tsx` — non-blocking duplicate warning (testID `review-duplicate-warning`): prefers hash match, falls back to name-lowercase + size match; primary CTA is **never** disabled by this warning.
- `app/(tabs)/docs.tsx` — additive sort chip row (testID `docs-sort-row`) with `sort-name`, `sort-added`, `sort-modified`, `sort-expiry`; layout uses a flex-1 wrapper around the horizontal ScrollView so the "Sort" label never overlaps.

## Prioritized Backlog / Next Tasks
### Phase 2 (not started)
- Google Drive Storage Engine — real Drive folder layout, per-user vault folder, resumable uploads > 5 MB via `RESUMABLE_UPLOAD_THRESHOLD_BYTES` route
- Metadata Management — server-side manifest for cross-device
- Folder Management
- Synchronization

### Phase 3 (not started)
- OCR
- Security hardening (key rotation, PIN, biometric unlock)

### Low-priority follow-ups from Phase 1 test reports
- (from `iteration_6`) On web only, both the Drive path and the local-fallback path fail because `expo-file-system.getInfoAsync` isn't implemented on web. Consider `Platform.OS !== 'web'` guarding the local fallback.
- (from `iteration_6`) Reset `uploadProgress` to 0 on `clearUploadError()` for extra clarity.
- (from `iteration_7`) VaultContext.addDoc uses `(input as any).fileHash` — could be typed cleanly into the Omit signature.

## Files Touched in Phase 1
- `/app/frontend/src/constants/upload.ts` (new)
- `/app/frontend/src/services/notifications.ts`
- `/app/frontend/src/services/storage.ts`
- `/app/frontend/src/services/drive.ts`
- `/app/frontend/src/contexts/VaultContext.tsx`
- `/app/frontend/src/contexts/UploadContext.tsx`
- `/app/frontend/src/types/index.ts`
- `/app/frontend/app/upload/file.tsx`
- `/app/frontend/app/upload/review.tsx`
- `/app/frontend/app/(tabs)/docs.tsx`

## Test Reports
- `iteration_4.json` — AuthContext TS fix (100%)
- `iteration_5.json` — Task 1 (100%)
- `iteration_6.json` — Task 2 (100%)
- `iteration_7.json` — Task 3 initial (90%, 1 HIGH + 1 design nit)
- `iteration_8.json` — Task 3 retest (100%, all resolved)
