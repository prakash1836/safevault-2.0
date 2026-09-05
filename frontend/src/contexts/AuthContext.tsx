import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthUser } from '../types';
import { storage } from '../services/storage';
import { fetchUserInfo, buildDemoUser, GOOGLE_SCOPES } from '../services/auth';
import { deriveAndStoreKey, clearKey, secureStore } from '../services/encryption';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

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

export  function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

const hasGoogleConfig = !!webClientId;

// useEffect(() => {
//   debugNotifications();
// }, []);

console.log("WEB CLIENT =", webClientId);
useEffect(() => {
  console.log("WEB CLIENT =", webClientId);
  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
    scopes: GOOGLE_SCOPES,
  });

  console.log("Google configured");
}, []);

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
            await deriveAndStoreKey(saved.id);
            setUser(saved);
          }
        }
      } catch (e) {
        console.warn('Failed to restore session:', e);
        setError('Session restore failed');
      } finally {
        setLoading(false);
      }
    })();
  }, []);


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

        await GoogleSignin.hasPlayServices();

        console.log("Play Services OK");
        const signInResult = await GoogleSignin.signIn();
        console.log("User signed in:", signInResult);

        if (signInResult.type !== 'success') {
            return { ok: false, reason: 'cancelled' };
        }

        const gUser = signInResult.data.user;
        const tokens = await GoogleSignin.getTokens();

        const accessToken = tokens.accessToken;

       const u: AuthUser = {
            id: gUser.id,
            email: gUser.email,
            name: gUser.name ?? '',
            picture: gUser.photo ?? undefined,
            accessToken,
            demo: false,
        };

        await secureStore.set(TOKEN_KEY, accessToken);

        await deriveAndStoreKey(u.id);

        await storage.setUser(u);

        setUser(u);

        return { ok: true };

    } catch (e: any) {

        if (e.code === statusCodes.SIGN_IN_CANCELLED)
            return { ok: false, reason: 'cancelled' };

        if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
            return { ok: false, reason: 'Play Services missing' };

        console.log("ERROR =", e);
        console.log("ERROR JSON =", JSON.stringify(e, null, 2));

        setError(e.message);

        return { ok: false, reason: e.message };
    }

}, [loginDemo, hasGoogleConfig]);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
     await GoogleSignin.signOut();

      await clearKey();

      await secureStore.del(TOKEN_KEY);

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
