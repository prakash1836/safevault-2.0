// Google Sign-In using Expo AuthSession.
// Falls back to demo mode when no Google client IDs configured.
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { AuthUser } from '../types';

WebBrowser.maybeCompleteAuthSession();

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export const GOOGLE_SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/drive.file',
];

export function getClientId(): string | null {
  return process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || null;
}

export async function fetchUserInfo(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed userinfo');
  return await res.json();
}

export function buildDemoUser(): AuthUser {
  return {
    id: 'demo-user-001',
    email: 'demo@safevault.app',
    name: 'Demo User',
    picture: undefined,
    demo: true,
  };
}

export { AuthSession, DISCOVERY };
