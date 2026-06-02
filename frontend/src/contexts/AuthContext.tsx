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
  error: string | null;
  loginDemo: () => Promise<void>;
  loginGoogle: () => Promise<{ ok: boolean; reason?: string }>;
  logout: () => Promise<void>;
  hasGoogleConfig: boolean;
  clearError: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

const TOKEN_KEY = 'safevault.google.token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Load saved user session on app start
  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.getUser();
        if (saved) {
          // Verify encryption key exists
          const key = await secureStore.get('safevault.enc.key.v1');
          if (key) {
            setUser(saved);
          } else {
            // Re-derive key from saved user
            try {
              await deriveAndStoreKey(saved.id);
              setUser(saved);
            } catch (keyError) {
              console.warn('Failed to derive encryption key:', keyError);
              // Clear corrupted session
              await storage.setUser(null);
              setError('Session recovery failed. Please log in again.');
            }
          }
        }
      } catch (e) {
        console.warn('Failed to restore session:', e);
        // Don't set error on initial load failure, just log it
        // User will see login screen naturally
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Handle redirect/response from Google auth
  useEffect(() => {
    (async () => {
      if (response?.type === 'success') {
        const accessToken = (response as any).authentication?.accessToken || (response as any).params?.access_token;
        if (!accessToken) {
          setError('No access token received');
          return;
        }
        try {
          setLoading(true);
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
          setError(null);
        } catch (e: any) {
          console.warn('Google login post-step failed', e);
          setError(e?.message || 'Login failed');
        } finally {
          setLoading(false);
        }
      } else if (response?.type === 'error') {
        setError(response.error?.message || 'Authentication error');
      }
    })();
  }, [response]);

  const loginDemo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const u = buildDemoUser();
      await deriveAndStoreKey(u.id);
      await storage.setUser(u);
      setUser(u);
    } catch (e: any) {
      setError(e?.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const loginGoogle = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    setError(null);
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
      const msg = e?.message || 'error';
      setError(msg);
      return { ok: false, reason: msg };
    }
  }, [hasGoogleConfig, promptAsync, loginDemo]);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      // Cancel all scheduled SafeVault reminders
      try {
        const Notifications = await import('expo-notifications');
        await Notifications.cancelAllScheduledNotificationsAsync();
      } catch {}
      // Clear encryption key and OAuth token first
      await clearKey();
      await secureStore.del(TOKEN_KEY);
      // Wipe ALL local vault data (docs, events, family, drive, retry queue, seeded flag)
      await storage.clearAll();
      // Finally clear session
      await storage.setUser(null);
      setUser(null);
      setError(null);
    } catch (e: any) {
      console.warn('Logout error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ user, loading, error, loginDemo, loginGoogle, logout, hasGoogleConfig, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
