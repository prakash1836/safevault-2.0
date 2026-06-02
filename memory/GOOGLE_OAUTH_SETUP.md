# SafeVault 2.0 — Google OAuth Production Setup

> Complete guide to configuring Google OAuth for development and production Android builds.

## Overview

SafeVault uses **Expo AuthSession** with the implicit token flow (PKCE). This means:
- No backend required
- OAuth tokens stay client-side
- User's Google Drive is accessed directly with `drive.file` scope (only files SafeVault creates)
- No central database needed

## 1. Google Cloud Console Setup

### 1.1 Create a Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: **SafeVault Production**
3. Enable APIs:
   - Google Drive API
   - Google People API (for user profile/email)

### 1.2 OAuth Consent Screen
1. Navigate to **APIs & Services → OAuth consent screen**
2. Choose **External** user type
3. Fill in:
   - App name: `SafeVault`
   - User support email: `<your-email>`
   - Developer contact: `<your-email>`
   - App logo: 120x120 PNG (use icon from `/app/frontend/assets/images/icon.png`)
   - Application home page: `https://safevault.app` (your domain)
   - Application privacy policy: `https://safevault.app/privacy` (required!)
   - Application terms of service: `https://safevault.app/terms`
   - Authorized domains: `safevault.app`
4. **Scopes** — add:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/drive.file` (RESTRICTED — requires verification for production)
5. **Test users**: Add up to 100 emails for closed-beta testing while in **Testing** mode
6. When ready for public release: **Submit for verification**

## 2. Create OAuth Client IDs

### 2.1 Web Client (for Expo dev + Auth on web)
1. **APIs & Services → Credentials → Create credentials → OAuth client ID**
2. Type: **Web application**
3. Name: `SafeVault Web`
4. Authorized JavaScript origins:
   - `https://auth.expo.io`
   - `http://localhost:8081` (dev)
   - `http://localhost:3000` (dev)
5. Authorized redirect URIs:
   - `https://auth.expo.io/@<your-expo-username>/safevault`
   - `http://localhost:8081`
6. Copy **Client ID** → add to `.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

### 2.2 Android Client (for APK + Play Store)
1. **Create credentials → OAuth client ID**
2. Type: **Android**
3. Name: `SafeVault Android`
4. Package name: `com.safevault.app`
5. **SHA-1 certificate fingerprint** — see Section 3
6. Copy **Client ID** → add to `.env` as `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

## 3. Get SHA-1 Fingerprints

### 3.1 Debug Builds (Expo Go / dev APK)
```bash
# Expo Go uses Expo's own SHA-1 — get it from:
eas credentials
# Select Android → fetch keystore credentials → "Build credentials" section
```

For Expo development APKs, run:
```bash
eas build --platform android --profile preview
# After build, EAS shows the SHA-1 in the credentials section
```

### 3.2 Production Builds (Play Store)
When using **Play App Signing** (recommended):
1. Build production AAB via `eas build --platform android --profile production`
2. Upload AAB to Play Console once
3. **Play Console → Setup → App signing** shows the **App signing key certificate SHA-1**
4. Add THAT SHA-1 to Google Cloud Console OAuth Android client

⚠️ Critical: The SHA-1 must match the actual signing key used by Play Store, not your local keystore.

## 4. Verification for Production

Google requires verification when using the `drive.file` scope:

1. **OAuth consent screen → Publish app**
2. Click **Submit for verification**
3. Provide:
   - Privacy policy URL
   - Demo video showing how `drive.file` is used (typically 2-5 min)
   - Justification document explaining why you need the scope
4. Verification takes 2-6 weeks. During this time the app stays in **Testing** mode (limited to 100 test users).

## 5. Verify OAuth Works

### Dev (Expo Go on real device)
1. Ensure your email is in **Test users** list
2. Run `yarn start`, scan QR with Expo Go
3. Tap "Continue with Google"
4. Browser opens → consent screen → redirect back to app
5. Should land on onboarding/home

### Production APK
1. After EAS Build completes, install APK on device
2. Tap "Continue with Google"
3. System Google chooser opens (native, not browser)
4. Select account → consent → redirect

## 6. Token Refresh Strategy

SafeVault uses **implicit flow** — tokens are short-lived (1 hour). When a token expires:
- Drive API calls return 401
- App catches this and prompts re-authentication
- Future: Add refresh token support via offline access (requires backend)

For v1.0, users re-login when tokens expire. This is acceptable for a security-first app.

## 7. Troubleshooting

### "Error 400: redirect_uri_mismatch"
- Verify redirect URIs in OAuth client match what Expo sends
- Expo's redirect: `https://auth.expo.io/@<your-username>/safevault`

### "Error 403: access_denied" on production
- App not yet verified by Google — submit for verification
- OR: Add user as Test User in OAuth consent screen

### Login completes but Drive uploads fail
- User declined `drive.file` scope during consent
- Solution: Log out and log in again, accept all scopes

### Android: OAuth redirects to browser instead of native chooser
- SHA-1 fingerprint mismatch — app doesn't match registered Android client
- Re-check the SHA-1 of the actual installed APK using `apksigner verify --print-certs app.apk`

## 8. Required Documents for Verification

| Document | Purpose |
|----------|---------|
| **Privacy Policy URL** | Must explain Drive access scope clearly |
| **Terms of Service URL** | Standard legal agreement |
| **Demo Video (2-5 min)** | Show full flow: login → permission grant → upload to Drive → view in Drive |
| **Justification PDF** | Explain why `drive.file` (not `drive.readonly`) is needed |
| **Brand Verification** | Domain ownership of your homepage URL |

## 9. Privacy Policy Template Outline

Your privacy policy should explicitly cover:

1. **What we collect:** Email, name, profile photo (from Google)
2. **What we do NOT collect:** Document contents (encrypted client-side), document metadata stays on device
3. **Drive scope explanation:** `drive.file` only accesses files SafeVault creates; we cannot see your other Drive files
4. **Encryption:** AES-256 client-side; keys never leave device; SafeVault servers (if any) cannot decrypt
5. **Third-party services:** Google APIs only
6. **Data deletion:** Users can delete files via app or directly in Google Drive
7. **Contact:** Support email
