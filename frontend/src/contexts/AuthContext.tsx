import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import { authService } from '../services/authService';
import type { AuthSession as AppAuthSession } from '../types';
import { GOOGLE_SCOPES } from '../utils/constants';

interface AuthContextValue {
  session: AppAuthSession | null;
  loading: boolean;
  clientIdMissing: boolean;
  signIn: () => Promise<AppAuthSession | null>;
  signOut: () => Promise<void>;
  request: AuthSession.AuthRequest | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppAuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const clientId = authService.clientId;
  const redirectUri = authService.redirectUri;
  const clientIdMissing = !clientId;

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId || 'MISSING',
      scopes: GOOGLE_SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
      extraParams: {
        access_type: 'online',
        include_granted_scopes: 'true',
        prompt: 'consent',
      },
    },
    authService.discovery,
  );

  // Restore stored session on mount
  useEffect(() => {
    (async () => {
      const stored = await authService.getStoredSession();
      setSession(stored);
      setLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (): Promise<AppAuthSession | null> => {
    if (!clientId) {
      throw new Error('Google Client ID is not configured. See SETUP_OAUTH.md.');
    }
    const result = await promptAsync();
    if (result.type === 'success') {
      const newSession = await authService.handleAuthResponse(result);
      setSession(newSession);
      return newSession;
    }
    if (result.type === 'error') {
      throw new Error(result.error?.message || 'Google sign-in failed.');
    }
    return null;
  }, [promptAsync, clientId]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, loading, clientIdMissing, signIn, signOut, request }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
