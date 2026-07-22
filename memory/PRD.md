# SafeVault — Product Requirements Document

## Original Problem Statement
Refine the existing SafeVault React Native (Expo + TypeScript) mobile app to a polished, premium-quality experience — like something built by Google, Notion, Apple, or Dropbox — without changing the navigation flow, architecture, or business logic. Preserve Google Drive integration and authentication. Improve spacing, typography, alignment, icon consistency, buttons, colors, empty/loading/success states, and branding. Add a modern SVG logo, an animated splash under 3s with tagline "Secure. Organize. Never Forget.", and elevate reminders on the dashboard.

## User Choices Captured
- Codebase access: use existing code in `/app`
- Deliverable order: prepare report and implement in the same pass
- Design direction: "You decide" — premium mobile aesthetic
- Color palette: **Trust Blue** as default (theme selector remains for user to change later)
- Logo: SVG-based

## Personas
- **First-time users** who need document security they can trust at a glance
- **Family administrators** managing IDs, insurance, and expiring documents for multiple people
- **Returning users** who rely on reminders to avoid missed renewals

## Architecture (unchanged)
- Expo Router file-based navigation
- Contexts: Auth, Vault, Upload, Theme (with runtime preset + custom hex), Permissions
- Client-side AES-256 encryption before Drive upload (drive.file scope)
- MongoDB backend (present, minimal use for this UI refinement)
- Reanimated 3 + Haptics for micro-interactions

## Core Requirements (Static)
- Never change navigation flow, screen names, feature names, or business logic
- Preserve Google Drive integration & authentication (Google Sign-In + demo mode)
- Every interactive element has `testID`
- Splash under 3 seconds
- Theme is user-changeable at any time

## What's Been Implemented (Jan 22, 2026)
- **`/app/UX_REPORT.md`** — full analysis: strengths, weaknesses, UI inconsistencies, UX improvements, components refined, animations, branding, accessibility, and performance considerations
- **`src/components/Logo.tsx`** — new SVG SafeVault brandmark (shield silhouette + vault dial + subtle document fold), plus `LogoMonogram` badge variant, with `onDark` mode for dark-hero backgrounds
- **`app/index.tsx`** — new animated splash: pop-in logo (spring scale), halo glow, "SafeVault" wordmark reveal, tagline "Secure. Organize. Never forget." — total ~1.6s before auto-navigation
- **`src/constants/theme.ts`** — refined default primary to Trust Blue `#2461E8` / dark `#0F1F52` / surface `#E4ECFB`; navy-tinted premium shadow layers
- **`src/contexts/ThemeContext.tsx`** — `ocean` preset renamed "Trust Blue" (`#2461E8`) and set as the default (preserving user preference on first launch)
- **`app/login.tsx`** — uses new `Logo`, updated tagline, refined CTA hierarchy (primary Google button + ghost demo link), staggered feature card reveals
- **`app/onboarding.tsx`** — shield tile now renders the new `Logo`
- **`app/(tabs)/_layout.tsx`** — animated pill background under the active tab (spring + fade); FAB has a subtle glow halo; haptic feedback on tab switches
- **`app/(tabs)/home.tsx`** — new **`PriorityReminderCard`** rendered above the Vault Health card whenever a document is expired or expiring (elevates reminders as the app's stated core value), subtle pulse animation for expired icon; vault ring color made theme-neutral (white on navy)
- **`app/settings/theme.tsx`** — default custom hex updated to `#2461E8`, swatch palette starts with Trust Blue
- **`app/upload/type.tsx`** — replaced hardcoded `colors.primary` with the active theme accent; entrance stagger; haptic selection
- **`app.json`** — native splash background updated from `#000` to `#0F1F52` (matches Trust Blue dark) for a seamless launch → animated splash → app transition
- Removed all lingering references to the old Forest palette in the default paths

## Prioritized Backlog / Next Tasks
- **P1**: Fix pre-existing TypeScript type errors in `src/contexts/AuthContext.tsx` (SignInResponse `user` field mismatch) — not blocking; unrelated to UI refinement
- **P2**: Optional custom font (e.g. Bricolage Grotesque via `expo-font`) for a more distinctive brand voice
- **P2**: Add subtle SVG illustrations to the `EmptyState` component (currently uses icon disc)
- **P2**: Confetti-lite on successful upload
- **P3**: Localize copy (currently English only)

## Files Touched (visual/theme layer only)
- `/app/UX_REPORT.md` (new)
- `/app/frontend/src/components/Logo.tsx` (new)
- `/app/frontend/src/constants/theme.ts` (modified)
- `/app/frontend/src/contexts/ThemeContext.tsx` (modified)
- `/app/frontend/app/index.tsx` (rewritten — animated splash)
- `/app/frontend/app/login.tsx` (modified)
- `/app/frontend/app/onboarding.tsx` (modified)
- `/app/frontend/app/(tabs)/_layout.tsx` (rewritten — active pill)
- `/app/frontend/app/(tabs)/home.tsx` (modified — Priority Reminder card)
- `/app/frontend/app/(tabs)/profile.tsx` (minor: fallback label)
- `/app/frontend/app/settings/theme.tsx` (minor: default hex + swatch order)
- `/app/frontend/app/upload/type.tsx` (fixed theme wiring)
- `/app/frontend/app.json` (splash background)

Business logic, encryption, drive service, authentication, storage, notifications, and navigation flow — **untouched**.
