# SafeVault — Password-protected files, backed up to Google Drive

Production-ready system that:
- Encrypts every file you upload into a **password-protected AES-256 ZIP**
- Uploads the ZIP to **your own Google Drive** (`drive.file` scope)
- Lets you **recover files on any device** by signing in again — no local index required
- Lets you **open the ZIP outside the app** with any standard unzipper (7-Zip, Keka, WinRAR…)

## Folder structure

```
frontend/
├─ app/                        # expo-router file-based routes
│  ├─ _layout.tsx             # providers + stack
│  ├─ index.tsx               # boot → redirects based on auth/password state
│  ├─ login.tsx               # Google sign-in screen
│  ├─ setup-password.tsx      # create vault password (first-time)
│  ├─ unlock.tsx              # enter password to unlock vault
│  ├─ vault.tsx               # file list (recovery target screen)
│  ├─ upload.tsx              # pick file → encrypt → upload
│  ├─ open.tsx                # download → decrypt → open/share
│  └─ settings.tsx            # account, lock, reset, sign out
└─ src/
   ├─ services/
   │  ├─ authService.ts        # Google OAuth via expo-auth-session
   │  ├─ driveService.ts       # Google Drive REST API (upload/list/download/delete)
   │  ├─ zipService.ts         # AES-256 ZIP (WinZip AES) via @zip.js/zip.js
   │  ├─ recoveryService.ts    # Loads vault purely from Drive; cache optional
   │  ├─ passwordService.ts    # PBKDF2 verifier; raw password never persisted
   │  └─ storageService.ts     # SecureStore (native) / localStorage (web)
   ├─ contexts/
   │  ├─ AuthContext.tsx       # Google auth session state
   │  └─ PasswordContext.tsx   # in-memory session password (never persisted)
   ├─ types/index.ts
   ├─ theme/theme.ts
   └─ utils/constants.ts
```

## End-to-end flow

### First-time use
1. `/login` — Sign in with Google (scope `drive.file` + `openid email profile`)
2. `/setup-password` — User creates vault password. Acknowledges that losing it = data loss. We store only `PBKDF2(password, salt, 150k iterations)`.
3. `/vault` — Empty. Tap **+ Upload**.
4. `/upload` — Pick a file, tap “Encrypt & upload”. Under the hood: file → AES-256 ZIP → Drive.

### Recovery (uninstall / new device)
1. Install the app, sign in with Google.
2. Create the **same password** (or any password — it's just a local verifier; decrypting a file still requires the original ZIP password).
3. `/vault` queries Drive with `appProperties has { key='safevault' and value='v1' }`. If the marker isn't found, we fall back to listing all ZIPs the app has access to.
4. Tap a file → enter the original password → decrypted file is shared via native share sheet (mobile) or downloaded (web).

### No single point of failure
- `vault_index.json` is **not required**. The vault is rebuilt on every session from Drive query.
- A local cache (`STORAGE_KEYS.cachedIndex`) exists for instant UI but is purely an optimization.

## Setup

1. **Google OAuth client IDs** — see [`SETUP_OAUTH.md`](./SETUP_OAUTH.md) at the project root.
   Fill `frontend/.env` with:
   ```
   EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=...
   EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=...
   EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=...
   ```
2. Restart the dev server.

## Encryption details
- **Algorithm:** AES-256 (WinZip AES, `encryptionStrength: 3`) — not legacy ZipCrypto.
- **Library:** `@zip.js/zip.js` (imported from `/index-native.cjs` to avoid bundler issues).
- **Interoperability:** any AES-256-capable unzipper (7-Zip, Keka, WinRAR, The Unarchiver) can open these with the same password.
- **Password storage:** never persisted in plaintext. A PBKDF2 verifier (SHA-256, 150k iters) is stored locally only to let us accept/reject the password at unlock time — the ZIP itself uses the raw password directly for its own PBKDF2 key derivation.
