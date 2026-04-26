import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthUser } from '../types';
import { storage } from '../services/storage';
import { buildDemoUser, fetchUserInfo, getClientId, GOOGLE_SCOPES, DISCOVERY } from '../services/auth';
import { deriveAndStoreKey, clearKey } from '../services/encryption';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  loginDemo: () => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  hasGoogleConfig: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const clientId = getClientId();
  const hasGoogleConfig = !!clientId;

  useEffect(() => {
    (async () => {
      const saved = await storage.getUser();
      if (saved) setUser(saved);
      setLoading(false);
    })();
  }, []);

  const loginDemo = useCallback(async () => {
    const u = buildDemoUser();
    await deriveAndStoreKey(u.id);
    await storage.setUser(u);
    setUser(u);
  }, []);

  const loginGoogle = useCallback(async () => {
    if (!clientId) {
      await loginDemo();
      return;
    }
    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'frontend' });
    const request = new AuthSession.AuthRequest({
      clientId,
      scopes: GOOGLE_SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
    });
    await request.makeAuthUrlAsync(DISCOVERY);
    const result = await request.promptAsync(DISCOVERY);
    if (result.type === 'success' && result.params.access_token) {
      const token = result.params.access_token;
      const info = await fetchUserInfo(token);
      const u: AuthUser = {
        id: info.sub,
        email: info.email,
        name: info.name,
        picture: info.picture,
        accessToken: token,
        demo: false,
      };
      await SecureStore.setItemAsync('safevault.google.token', token);
      await deriveAndStoreKey(u.id);
      await storage.setUser(u);
      setUser(u);
    } else {
      throw new Error('Google sign-in cancelled');
    }
  }, [clientId, loginDemo]);

  const logout = useCallback(async () => {
    await clearKey();
    await SecureStore.deleteItemAsync('safevault.google.token').catch(() => {});
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
