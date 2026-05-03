// Holds the user's password in-memory for the current session only.
// Never persisted. Cleared on app reload or explicit lock.

import React, { createContext, useContext, useState, useCallback } from 'react';

interface PasswordContextValue {
  sessionPassword: string | null;
  setSessionPassword: (p: string | null) => void;
  lock: () => void;
}

const PasswordContext = createContext<PasswordContextValue | undefined>(undefined);

export function PasswordProvider({ children }: { children: React.ReactNode }) {
  const [sessionPassword, setSessionPasswordState] = useState<string | null>(null);

  const setSessionPassword = useCallback((p: string | null) => {
    setSessionPasswordState(p);
  }, []);

  const lock = useCallback(() => setSessionPasswordState(null), []);

  return (
    <PasswordContext.Provider value={{ sessionPassword, setSessionPassword, lock }}>
      {children}
    </PasswordContext.Provider>
  );
}

export function usePassword(): PasswordContextValue {
  const ctx = useContext(PasswordContext);
  if (!ctx) throw new Error('usePassword must be used inside PasswordProvider');
  return ctx;
}
