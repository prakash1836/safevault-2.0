import React, { createContext, useContext, useEffect, useState } from 'react';
import type { DocCategory, DocReminder, StorageMode } from '../types';
import { StoragePreference } from '../services/storagePreference';

export interface UploadDraft {
  category: DocCategory | null;
  name: string;
  fileBase64: string | null;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  /** SHA-256 hex digest of the raw file bytes; used for duplicate detection. */
  fileHash: string | null;
  ownerId: string;
  issueDate: string | null;
  expiryDate: string | null;
  notes: string;
  reminder: DocReminder;
  /** Per-document storage choice. Defaults from `StoragePreference.getMode()` on mount. */
  storageMode: StorageMode;
}

const EMPTY: UploadDraft = {
  category: null,
  name: '',
  fileBase64: null,
  fileName: null,
  mimeType: null,
  size: null,
  fileHash: null,
  ownerId: 'me',
  issueDate: null,
  expiryDate: null,
  notes: '',
  reminder: { days30: true, days7: true, days1: true },
  storageMode: 'both',
};

interface Ctx {
  draft: UploadDraft;
  setDraft: (patch: Partial<UploadDraft>) => void;
  reset: () => void;
}

const UploadContext = createContext<Ctx | null>(null);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraftState] = useState<UploadDraft>(EMPTY);

  // Hydrate the last-used storage mode on mount so the default reflects the
  // user's most recent choice.
  useEffect(() => {
    (async () => {
      try {
        const mode = await StoragePreference.getMode();
        setDraftState((d) => ({ ...d, storageMode: mode }));
      } catch {
        /* fall back to 'both' */
      }
    })();
  }, []);

  const setDraft = (patch: Partial<UploadDraft>) => setDraftState((d) => ({ ...d, ...patch }));
  const reset = () =>
    setDraftState((d) => ({ ...EMPTY, storageMode: d.storageMode }));
  return <UploadContext.Provider value={{ draft, setDraft, reset }}>{children}</UploadContext.Provider>;
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload outside provider');
  return ctx;
}
