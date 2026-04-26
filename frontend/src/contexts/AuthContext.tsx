import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthUser } from '../types';
import { storage } from '../services/storage';
import { fetchUserInfo, buildDemoUser, GOOGLE_SCOPES } from '../services/auth';
import { deriveAndStoreKey, clearKey, secureStore } from '../services/encryption';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  loginDemo: () => Promise<void>;
  loginGoogle: () => Promise<{ ok: boolean; reason?: string }>;
  logout: () => Promise<void>;
  hasGoogleConfig: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

const TOKEN_KEY = 'safevault.google.token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const hasGoogleConfig = !!webClientId;

  // Configure Google AuthRequest hook (no backend, implicit token flow with drive.file scope)
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const [, response, promptAsync] = Google.useAuthRequest({
    webClientId,
    androidClientId,
    iosClientId,
    scopes: GOOGLE_SCOPES,
    selectAccount: true,
  });

  useEffect(() => {
    (async () => {
      const saved = await storage.getUser();
      if (saved) setUser(saved);
      setLoading(false);
    })();
  }, []);

  // Handle redirect/response from Google auth
  useEffect(() => {
    (async () => {
      if (response?.type === 'success') {
        const accessToken = (response as any).authentication?.accessToken || (response as any).params?.access_token;
        if (!accessToken) return;
        try {
          const info = await fetchUserInfo(accessToken);
          const u: AuthUser = {
            id: info.sub,
            email: info.email,
            name: info.name,
            picture: info.picture,
            accessToken,
            demo: false,
          };
          await secureStore.set(TOKEN_KEY, accessToken);
          await deriveAndStoreKey(u.id);
          await storage.setUser(u);
          setUser(u);
        } catch (e) {
          console.warn('Google login post-step failed', e);
        }
      }
    })();
  }, [response]);

  const loginDemo = useCallback(async () => {
    const u = buildDemoUser();
    await deriveAndStoreKey(u.id);
    await storage.setUser(u);
    setUser(u);
  }, []);

  const loginGoogle = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    if (!hasGoogleConfig) {
      await loginDemo();
      return { ok: true, reason: 'demo' };
    }
    try {
      const r = await promptAsync();
      if (r.type === 'success') return { ok: true };
      if (r.type === 'cancel' || r.type === 'dismiss') return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: 'error' };
    } catch (e: any) {
      return { ok: false, reason: e?.message || 'error' };
    }
  }, [hasGoogleConfig, promptAsync, loginDemo]);

  const logout = useCallback(async () => {
    await clearKey();
    await secureStore.del(TOKEN_KEY);
    await storage.setUser(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginDemo, loginGoogle, logout, hasGoogleConfig }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
