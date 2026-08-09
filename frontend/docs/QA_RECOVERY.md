# SafeVault — Physical-Device Recovery QA Checklist

> **This checklist has NOT been executed** in the container running this
> codebase. The container has no Android emulator, no real Google Drive
> account, and no way to install a Dev-Client APK on a physical phone.
> Follow the steps below on two real Android devices (A and B) with the same
> Dev-Client APK produced by `.github/workflows/android-debug.yml`.

## Prerequisites
1. GitHub Actions has produced a debug APK — download the `SafeVault-DevClient-Debug-APK` artifact from the "Android Development Build (Dev Client)" workflow.
2. Install on **Device A** and **Device B** via `adb install -r SafeVault-dev-client-debug.apk`.
3. On your laptop: `cd frontend && yarn install && npx expo start --dev-client --clear` (both phones on the same Wi-Fi).
4. Have a **spare** Google account handy; do not use your primary account until the flow passes on a test account.

## DEVICE A — establish the vault

- [ ] A1. Open SafeVault. Complete the onboarding stepper (Welcome → Details → Security → Storage → Drive → Encryption → Pricing → Permissions).
- [ ] A2. During Vault Security step, set a Recovery Password you will remember (e.g. `AlphaZebraBanana!42`).
- [ ] A3. Complete onboarding all the way to the dashboard.
- [ ] A4. Add doc **Local-only.pdf** with Storage Type = "Local Vault".
- [ ] A5. Add doc **Drive-only.pdf** with Storage Type = "Secure Cloud Vault".
- [ ] A6. Add doc **Both.pdf** with Storage Type = "Local + Secure Cloud".
- [ ] A7. Open each document → confirm it decrypts and displays.
- [ ] A8. Profile → Storage & Security → confirm banner reads **Recovery configured**.
- [ ] A9. Open Drive on a laptop → confirm folders exist under `SafeVault/`:
    - `manifest/metadata.json`
    - `manifest/recovery.json`
    - `docs/<docId>/v1.enc` (2 folders — Drive-only + Both)
- [ ] A10. Peek at `recovery.json` — confirm it has `"schema": "safevault.recovery.v2"` and a `"mac"` field.

## DEVICE B — new-device restore

- [ ] B1. Fresh install of the same APK on Device B (`adb uninstall com.safevault.app` first if necessary).
- [ ] B2. Login screen → tap **Restore from Google Drive →**.
- [ ] B3. Connect the same Google account. Recovery screen should show **Vault found · rev X**.
- [ ] B4. Enter the Recovery Password from A2.
- [ ] B5. Confirm **Restore Progress** appears in this order:
    - "Loading your vault index…"
    - "Downloading manifest…"
    - "Loaded 2 documents from Drive" (or 3 if Both counts as one)
- [ ] B6. Confirm success screen shows **Vault Restored — Loaded N documents from your Drive**.
- [ ] B7. Confirm the "Local Vault only" note appears (Local-only limitation).
- [ ] B8. Tap **Open my Vault**. Home tab should list Drive-only.pdf and Both.pdf.
- [ ] B9. **Local-only.pdf should NOT appear.**
- [ ] B10. Open Drive-only.pdf → confirm progress overlay (Downloading Secure Copy → Decrypting → Opening) and file opens.
- [ ] B11. Open Both.pdf → confirm decryption succeeds.

## FAILURE TESTS (Device B)

- [ ] F1. **Wrong Recovery Password** → confirm exactly the message *"Incorrect Recovery Password. Your vault has not been changed. You have N attempt(s) remaining before a lockout begins."* No local DEK is installed (verify by attempting to open a doc — should fail gracefully).
- [ ] F2. **Four wrong attempts** → confirm the countdown UI appears: *"Attempt 4 of your recovery password was incorrect. Please wait 30s before trying again."* Countdown ticks in real time. After 30s the input becomes usable again.
- [ ] F3. **Attempts 5, 6, 7, 8** → confirm the sequence 2 min → 10 min → 1 h → 24 h. (For QA tolerance, tap through only up to attempt 5; observe the label displays "2m 00s" and start of tick.)
- [ ] F4. **Cancel recovery** → back out mid-flow. Confirm no DEK is installed; the app returns to the login screen; Drive envelope untouched.
- [ ] F5. **Network off (airplane mode)** → open Restore → phase = *"Drive unreachable"*. Turn network on → tap Retry → search succeeds.
- [ ] F6. **Corrupted recovery.json** — on the laptop, overwrite `SafeVault/manifest/recovery.json` with the literal string `{"schema":"safevault.recovery.v2","garbage":true}`. Then on Device B run Restore. Confirm phase = *"Recovery envelope is corrupted"*. The DEK is NOT installed.
- [ ] F7. **Valid `recovery.bak`** — restore the corrupted primary from the backup by copying `recovery.bak` → `recovery.json` in Drive. Restore should now succeed with the message *"Recovered from backup manifest · N documents"* on the progress card.
- [ ] F8. **Tampered MAC** — edit `recovery.json`, flip one hex char in the `mac.hex` field, re-upload. On Device B Restore → phase = *"Recovery envelope tampered"*. Alert message: *"The recovery envelope failed integrity verification (MAC mismatch)."*
- [ ] F9. **Older revision** — from Device A, run Storage & Security → Change Recovery Password. Confirm envelope bumps from rev N to rev N+1 in Drive. Then manually overwrite `recovery.json` in Drive with the original rev-N envelope (still in `recovery.bak`). On Device A → attempt Restore. Confirm the message *"Recovery envelope is older than expected. This device previously accepted a newer recovery envelope."* Vault untouched.
- [ ] F10. **Invalid `recovery.bak`** — corrupt `recovery.json` AND `recovery.bak`. Restore → phase = *"Recovery envelope is corrupted"* → "The primary + backup envelopes both failed to parse" language shown. No DEK installed.

## MULTI-DEVICE TESTS

- [ ] M1. On Device B (post-restore) → add a new doc **FromB.pdf** with Storage Type = Both.
- [ ] M2. On Device A → pull-to-refresh Home. Confirm FromB.pdf appears.
- [ ] M3. Open FromB.pdf on Device A → decryption succeeds (same DEK).
- [ ] M4. On Device A → add **FromA.pdf** Both mode. On Device B, refresh → confirm it appears and opens.
- [ ] M5. On Device B → Settings → Storage & Security → Change Recovery Password from `OldPw!` → `NewPw!`. Confirm envelope revision bumps in Drive.
- [ ] M6. On Device A → open Storage & Security. Confirm cross-device banner: *"Recovery password changed on another device"* with the new revision.
- [ ] M7. On Device A → tap the banner → confirm it routes to Restore.
- [ ] M8. On Device A → open existing docs (FromA.pdf, Both.pdf). Confirm they still open — DEK was NOT changed by the password change.
- [ ] M9. On a THIRD hypothetical device C → try restore with `OldPw!` → fails "Incorrect Recovery Password". Try `NewPw!` → succeeds.

## Data to record in the QA log

For each numbered step above capture:
- pass/fail
- exact message shown if UI text differs from the checklist
- Android version + device model
- APK commit hash (from build artifact metadata)
- exact time of the run (for correlation with backend/Drive logs)

## Known things that CAN'T be tested here without extra tooling
- Envelope `appProperties['safevault.revision']` update on Drive is only observable via the Drive API — the app doesn't surface it. Use the Google Drive REST API or a quick script (`drive.files.get` with fields=appProperties).
- MAC comparison timing side-channel — SafeVault uses `constantTimeEqualHex`; measuring is a laboratory task, not standard QA.
