# SafeVault 2.0 — Release Guide

> End-to-end process from commit → Play Store production

## Release Pipeline Overview

```
Local dev → Preview APK → Internal track → Closed beta → Open beta → Production rollout
```

## Phase 1: Pre-flight

Run before every release:

```bash
cd /app/frontend
# 1. TypeScript clean
npx tsc --noEmit --skipLibCheck

# 2. Lint clean
npx expo lint

# 3. Bump version
# Edit app.json: bump version + versionCode + (optionally) runtimeVersion
```

Version bump strategy:
- **Patch** (1.0.0 → 1.0.1): bug fixes, no UX change → keep runtimeVersion same (OTA possible)
- **Minor** (1.0.x → 1.1.0): new features, no native changes → keep runtimeVersion same
- **Major** (1.x → 2.0.0): native module changes, breaking API → bump runtimeVersion (full rebuild required)

`versionCode` ALWAYS increments by 1, regardless of semver.

## Phase 2: Preview Build (Sideload Testing)

```bash
eas build --platform android --profile preview --non-interactive
```

After build (~10 min):
1. Download APK from EAS dashboard URL printed
2. Install on 1-3 test devices
3. Verify against checklist (see `/app/memory/FINAL_REPORT.md` Real-Device Testing Checklist)
4. If issues found → fix → bump versionCode → rebuild

## Phase 3: Production AAB

```bash
eas build --platform android --profile production --non-interactive
```

Produces `.aab` (Android App Bundle) optimized for Play Store delivery.

## Phase 4: Play Console Upload

### 4.1 Internal Testing Track (10 testers, 1 week)

1. Sign in to [Google Play Console](https://play.google.com/console)
2. **Testing → Internal testing → Create new release**
3. Upload the AAB
4. Release notes: brief, user-facing (avoid jargon)
5. **Testers** tab: add up to 100 Google emails (use Google Groups for scale)
6. **Roll out** → release link is sent to testers via email

### 4.2 Closed Beta (100 testers, 2 weeks)

1. **Testing → Closed testing → Create track**
2. Promote internal release OR upload new AAB
3. Send opt-in URL to recruited beta users
4. Monitor:
   - Pre-launch report (Google's automated testing on 100+ devices)
   - Vitals dashboard (ANR rate, crash rate)
   - Reviews
5. Gate metrics for moving to production:
   - Crash-free rate ≥ 99%
   - ANR rate < 0.5%
   - Average rating ≥ 4.0
   - No P0 bugs in past 7 days

### 4.3 Production Rollout (Staged)

1. **Production → Create release**
2. Set **Staged rollout**: 5%
3. Monitor for 48h, then 20%
4. Monitor 48h, then 50%
5. Monitor 48h, then 100%

If crash rate spikes at any stage → **Halt rollout** in Play Console immediately.

## Phase 5: Submit to Play Store

```bash
# Once eas.json has submit config:
eas submit --platform android --latest
```

This uploads the latest production build to Play Console automatically (saves you the manual upload step).

## Required Play Console Assets

### Listing
- [ ] App icon 512x512 PNG (no alpha)
- [ ] Feature graphic 1024x500 PNG/JPG
- [ ] Screenshots: 2-8 phone shots (1080x1920 or higher)
- [ ] Optional: 7-10 inch tablet shots
- [ ] Short description (80 chars):
  ```
  Encrypted document vault. Your files, your keys, your Drive.
  ```
- [ ] Full description (up to 4000 chars). Include:
  - Hero pitch
  - Top 5 features
  - Security guarantees
  - Privacy summary
  - Permissions justification

### Categorization
- [ ] Category: **Productivity** (primary) or **Tools** (secondary)
- [ ] Tags: encryption, documents, vault, drive, reminder
- [ ] Content rating: complete questionnaire (likely **Everyone**)

### Compliance
- [ ] **Privacy Policy URL** — required for apps accessing Drive
- [ ] **Terms of Service URL**
- [ ] **Data Safety form** — declare:
  - We do collect: Email, name (for OAuth)
  - We do NOT collect: file contents, document metadata
  - File contents encrypted in transit AND at rest
  - User can delete data anytime
  - Optional fields
- [ ] **App access**: provide test credentials for Google review
- [ ] **Target audience and content** declaration

## Required Google Cloud Console Setup

See `/app/memory/GOOGLE_OAUTH_SETUP.md` for full details. Summary:

1. [ ] Production OAuth client (Android) with Play App Signing SHA-1
2. [ ] OAuth consent screen published (not in Testing mode) — requires Google verification (2-6 weeks)
3. [ ] Drive API enabled
4. [ ] Privacy policy and terms URLs added

## Release Notes Template

```
Version 1.0.0 (1) — Initial release

What's new:
• Encrypted document vault using AES-256
• Google Drive sync (only files SafeVault creates)
• Smart reminders: 30, 7, and 1 day before expiry
• Biometric app lock (fingerprint, face)
• Works offline — syncs when connected
• Family member organization
• Beautiful, accessible design

We never see your documents. Your encryption keys never leave your device.
```

## Post-Release Monitoring

### First 24 hours
- Watch Play Console **Vitals** every 4 hours
- Monitor crash reports in Sentry (or `adb logcat` on test devices)
- Read all reviews — respond to critical ones within 24h

### First 7 days
- Daily check of vitals dashboard
- Address any P0/P1 issues with hotfix release
- Track activation funnel (install → first upload)

### Ongoing
- Weekly review of:
  - Crash-free rate (target ≥ 99.5%)
  - ANR rate (target < 0.5%)
  - Uninstall rate (target < 30% by D7)
  - 4+ star rating (target ≥ 4.2)

## Emergency Rollback

If a release has a critical bug:

1. **Play Console → Production → Halt rollout**
2. Roll forward with a fix (faster than rollback):
   ```bash
   # Bump version + fix bug
   eas build --platform android --profile production
   # Upload, set staged rollout to 5% to replace bad version
   ```
3. For users already on bad version: explain in release notes, provide manual workaround

## Hotfix Process

For critical bugs after release:

1. Branch off the release tag
2. Apply minimal fix
3. Bump patch version (1.0.0 → 1.0.1) + versionCode (1 → 2)
4. Skip Internal/Closed beta if confidence is high
5. Push to Production at 100% (no staged rollout for hotfixes)
6. Communicate in release notes

## Files for This Process

- `/app/memory/BUILD_GUIDE.md` — How to build
- `/app/memory/GOOGLE_OAUTH_SETUP.md` — OAuth configuration
- `/app/memory/SECURITY_MIGRATION.md` — Encryption format details
- `/app/memory/APK_RELEASE_CHECKLIST.md` — Pre-release validation
- `/app/memory/FINAL_REPORT.md` — Production readiness report
- `/app/memory/PRD.md` — Product requirements + cumulative log

## Useful Commands

```bash
# Check current EAS profile
eas build:configure --platform android

# View past builds
eas build:list --platform android --limit 10

# Cancel a stuck build
eas build:cancel <build-id>

# Get APK SHA-1 fingerprint
keytool -printcert -jarfile app.apk

# Verify APK signature
apksigner verify --verbose --print-certs app.apk

# Test deep links locally
adb shell am start -W -a android.intent.action.VIEW -d "safevault://document/abc123" com.safevault.app
```
