# SafeVault — Product Requirements Document

## Vision
A no-server, client-encrypted personal document vault that lives in the user's own Google Drive. Trust-forward, family-friendly, beautifully designed.

## ⚠️ Known Limitation: Google OAuth in Expo Go
Google OAuth does not work in Expo Go due to redirect URI requirements. Google requires redirect URIs with proper domains (`.com`, `.org`, etc.) and does not accept `exp://` scheme URLs.

**Workarounds:**
1. **Demo Mode** - Fully functional, uses local storage instead of Google Drive
2. **Development Build** - Build a custom Expo development build for full Google OAuth support

## Implemented Features

### Authentication & Onboarding
- **Splash → Login → Onboarding → Home** flow
- **Login screen**: Logo (Shield icon) + tagline + 3 feature pillars + Drive education
- **Real Google OAuth** via `expo-auth-session/providers/google` (Web + Android Client IDs configured)
- **Demo Mode**: bypasses OAuth, creates synthetic user, seeds vault
- **One-time Onboarding**: Drive connect + Notifications + Photos permissions, with mandatory warnings if skipped

### Vault & Documents
- AES-256 encryption (`crypto-js` PBKDF2-derived key, IV per file)
- Platform-aware secure storage (SecureStore on native, AsyncStorage fallback on web)
- 4-step Upload Wizard: Type → File → Details → Review (with sample-file fallback for web preview)
- Document Detail screen with **Edit** + **Download** + Delete
- Document categories: Insurance, ID, Health, Finance, Education, Property, Vehicle, Other
- Status badges: Valid / Expiring / Expired / Overdue

### Home Dashboard
- **Vault Health** circular metric card (themed accent)
- **Drive Storage Meter** with low-space warning
- **Notification Bell** with badge + bottom-sheet alerts feed (expiring, expired, drive-low, permission warnings)
- "Needs Attention" list (expiring/expired docs)
- "Missing in your vault" suggestions (Passport, Aadhaar, etc.)
- Family carousel (tap to focus member)

### Timeline
- 3 view modes: **All / By Month / By Year**
- Member filter chips
- Color-coded expiring (amber) and overdue (red) items
- Member avatar/name on each row
- Tap doc-event → opens detail

### Documents Hub
- Search + Status filter (All / Expiring / Valid / Expired)
- **Member filter** chips (separate row, fixed wrap bug — chips no longer stretch vertically)
- **Group toggle**: List view vs By Upload Month
- Cards with thumbnail, owner name, expiry, status badge

### Family Management
- Photo upload **with crop** (`expo-image-picker` `allowsEditing: true`)
- Initials fallback when no photo
- Add / Edit / Remove members (DOB, relation)
- **Tap member → see all their documents** (modal)

### Theme System
- 5 presets: Forest Green, Ocean Blue, Royal Purple, Sunset Orange, Charcoal
- **Custom hex color picker** with auto-derived dark + surface tones
- Persists via AsyncStorage
- Live preview card

### Profile
- Permission warnings panel (red banner if any are off) with quick-grant buttons
- Theme link, Family link, Drive connect link, Reminders, Security info, About
- Signout with confirmation

### Notifications & Alerts
- 30/7/1-day reminders scheduled per document via `expo-notifications`
- Home screen alert sheet aggregates: expired docs, expiring soon, drive low, missing permissions
- Android notification channel configured

### Mobile Polish
- Bottom tab bar respects **safe area insets** (no overlap with home indicator)
- Filter chips use `flexShrink: 0` to prevent vertical wrapping
- Themed FAB at center
- KeyboardAvoidingView on form screens

## Stack
- React Native 0.81 + Expo SDK 54
- Expo Router (file-based)
- TypeScript strict
- AsyncStorage + SecureStore + expo-file-system (encrypted file cache)
- crypto-js (AES-256-CBC, PBKDF2)
- expo-auth-session/providers/google
- expo-notifications, expo-image-picker, expo-document-picker, expo-media-library
- lucide-react-native icons

## Architecture
- `src/contexts/`: AuthContext · VaultContext · UploadContext · ThemeContext · PermissionsContext
- `src/services/`: encryption · drive · auth · storage · notifications
- `src/components/`: UI primitives (PrimaryButton, Chip, StatusBadge, Card, ProgressBar, Stepper)
- `app/`: file-based routes (login, onboarding, (tabs), upload/, document/[id], family, settings/theme)
