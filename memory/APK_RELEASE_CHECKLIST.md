# SafeVault 2.0 — APK Build & Play Store Readiness

> Date: 2026-01 · Stack: React Native 0.81.5 · Expo SDK 54 · expo-router 6

---

## ✅ APK Testing Checklist

### 1. Build Configuration
- [x] `app.json` package name: `com.safevault.app`
- [x] Android permissions declared (INTERNET, ACCESS_NETWORK_STATE, READ/WRITE_EXTERNAL_STORAGE, READ_MEDIA_IMAGES/VIDEO, CAMERA, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM)
- [x] Adaptive icon configured
- [x] Edge-to-edge enabled
- [x] expo-local-authentication plugin with `faceIDPermission`
- [ ] **TODO before APK build**: bump `version` & `runtimeVersion` for OTA tracking
- [ ] **TODO before APK build**: configure signing keystore via EAS

### 2. Pre-flight on Device
| Flow | Expected | Owner |
|------|----------|-------|
| Cold-start splash | Branded splash → login (if no session) or home (if session restored) | QA |
| Google OAuth login | Browser → consent → redirect back → onboarding | QA |
| Demo login | Tap "Try Demo Mode" → onboarding | QA |
| Permission denial | Toast + "Open Settings" deep-link (Android 13+) | QA |
| Biometric enable | Toggle in Profile → biometric prompt → success → re-prompt on next cold-start | QA |
| Background → Foreground | Biometric re-lock when enabled | QA |
| Document upload | Pick file → progress bar shows stages (Preparing/Encrypting/Uploading/Finalizing) | QA |
| Document upload (offline) | Auto-fallback to local storage + sync-pending badge | QA |
| Network reconnect | Auto-retry pending uploads, banner clears | QA |
| Notification scheduling | 30/7/1 day reminders fire on time | QA |
| Crash recovery | Error boundary catches errors with "Try Again" button | QA |
| File size limit | 50MB cap with friendly error | QA |
| Logout & re-login | Session persistence; encryption key recoverable | QA |

### 3. Performance Benchmarks (target)
- Cold start: < 2.5s
- Document list scroll (100+ items): 60 FPS (FlatList virtualization enabled)
- Upload encryption (5 MB PDF): < 3s
- Decryption preview (image): < 1.5s

### 4. Known Limitations
- `expo-file-system/legacy` still used — migration to new File/Directory API deferred to post-MVP (legacy is supported through SDK 54)
- Encryption key recovery: if SecureStore is cleared (app uninstall), local-only files are unrecoverable. Google Drive-backed files re-decrypt on login.
- Web preview: biometric / file picker / native auth are no-op (by design — web target is for layout QA only)

---

## 📱 Play Store MVP Readiness

### Required Before Publishing
- [ ] Bump version to `1.0.0` / versionCode `1`
- [ ] Add **privacy policy** URL (required for any app accessing Drive/Notifications/Media)
- [ ] Add **terms of service** URL
- [ ] **Data safety form** — declare:
  - Files encrypted client-side (AES-256)
  - No data sent to SafeVault servers (zero-knowledge)
  - Drive scope: `drive.file` (only files SafeVault creates)
- [ ] Screenshots (5 minimum): Login, Home, Documents, Document Detail, Profile
- [ ] Feature graphic 1024x500
- [ ] Short description (80 chars): "Encrypted document vault. Your files, your keys, your Drive."
- [ ] Full description (4000 chars)

### Google API Console
- [ ] Production OAuth consent screen submitted for review (currently in testing mode)
- [ ] App verification with Google for restricted scopes (`drive.file`) if needed
- [ ] Add Play Store SHA-1 fingerprint to OAuth client

### Build & Release
- [ ] Set up EAS Build: `eas build --platform android --profile production`
- [ ] Configure `eas.json` with production keystore
- [ ] Internal testing track first (10 testers)
- [ ] Closed beta (100 testers)
- [ ] Production rollout (staged 5% → 20% → 50% → 100%)

### Compliance & Legal
- [ ] GDPR compliance (data export / deletion endpoints — current architecture: user owns Drive folder, can delete anytime)
- [ ] CCPA disclosure
- [ ] Age rating questionnaire (likely Everyone)
- [ ] Add in-app **"Delete my data"** flow (clears local cache + revokes Drive token)

### Optional but Recommended
- [ ] Crashlytics / Sentry for production error tracking
- [ ] Analytics (Expo Analytics or Firebase) for usage insights
- [ ] App Store badge graphics
- [ ] Promo video (30-60s)

---

## 🗺️ Post-MVP Roadmap

### v1.1 — Reliability Polish
- Migrate to new `expo-file-system` File/Directory API
- Add Sentry crash reporting
- Background sync via expo-task-manager (sync queue while app is closed)
- Encryption key backup via passphrase (recover on reinstall)

### v1.2 — Collaboration
- Family member sharing (view-only docs)
- iCloud Drive support (iOS parity)
- Document tagging & advanced search

### v1.3 — AI Helpers
- Auto-extract expiry dates via OCR
- Smart categorization (insurance, ID, etc.)
- Document summary on long-press

### v2.0 — Premium Tier
- Unlimited family members (free: 3)
- Document history / version control
- Custom retention policies
- White-label for enterprise

---

## 📌 Quick Commands

```bash
# Build APK (development)
cd /app/frontend
npx expo prebuild --platform android
npx eas build --platform android --profile preview --local

# Build AAB for Play Store
npx eas build --platform android --profile production

# Submit to Play Store
npx eas submit --platform android --latest

# Local dev
yarn start
```

---

## 🔐 Security Audit Checklist (pre-launch)

- [x] AES-256 encryption with PBKDF2-SHA256 key derivation (10k iterations)
- [x] Keys stored in OS keychain (SecureStore on native)
- [x] No plaintext PII in logs
- [x] HTTPS-only for Drive API
- [x] OAuth token refresh handled
- [x] Permission rationale strings in app.json
- [ ] Run `expo doctor` and resolve all warnings
- [ ] OWASP MASVS L1 audit
- [ ] Penetration test on staging APK
