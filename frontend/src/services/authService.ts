// Google OAuth via expo-auth-session.
// Requests the `drive.file` scope so we can upload to the user's Drive.

import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { storage } from './storageService';
import { GOOGLE_SCOPES, STORAGE_KEYS } from '../utils/constants';
import type { AuthSession as AppAuthSession, GoogleUser } from '../types';

WebBrowser.maybeCompleteAuthSession();

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

function pickClientId(): string {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS
      || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '';
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID
      || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '';
  }
  return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '';
}

export function getClientId(): string {
  return pickClientId();
}

export function getRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'frontend',
    path: 'oauthredirect',
  });
}

async function fetchUserInfo(accessToken: string): Promise<GoogleUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch user info: ${res.status}`);
  const data = await res.json();
  return {
    id: data.sub,
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

export const authService = {
  discovery,
  scopes: GOOGLE_SCOPES,
  clientId: getClientId(),
  redirectUri: getRedirectUri(),

  /** Exchange the authResponse from useAuthRequest for a persisted session. */
  async handleAuthResponse(
    result: AuthSession.AuthSessionResult,
  ): Promise<AppAuthSession | null> {
    if (result.type !== 'success') return null;
    const params = (result as AuthSession.AuthSessionResult & {
      params: Record<string, string>;
    }).params;

    const accessToken = params.access_token;
    if (!accessToken) throw new Error('No access_token returned from Google.');

    const expiresIn = parseInt(params.expires_in || '3600', 10);
    const user = await fetchUserInfo(accessToken);

    const session: AppAuthSession = {
      accessToken,
      refreshToken: params.refresh_token,
      expiresAt: Date.now() + expiresIn * 1000,
      user,
    };
    await storage.setItem(STORAGE_KEYS.authSession, JSON.stringify(session));
    return session;
  },

  async getStoredSession(): Promise<AppAuthSession | null> {
    const raw = await storage.getItem(STORAGE_KEYS.authSession);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as AppAuthSession;
      if (Date.now() >= s.expiresAt - 30_000) return null; // consider expired
      return s;
    } catch {
      return null;
    }
  },

  async signOut(): Promise<void> {
    const raw = await storage.getItem(STORAGE_KEYS.authSession);
    if (raw) {
      try {
        const s = JSON.parse(raw) as AppAuthSession;
        // Best-effort revoke
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(s.accessToken)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }).catch(() => undefined);
      } catch {
        // ignore
      }
    }
    await storage.removeItem(STORAGE_KEYS.authSession);
  },
};
