import React, { createContext, useContext, useState } from 'react';
import type { DocCategory, DocReminder } from '../types';

export interface UploadDraft {
  category: DocCategory | null;
  name: string;
  fileBase64: string | null;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  ownerId: string;
  issueDate: string | null;
  expiryDate: string | null;
  notes: string;
  reminder: DocReminder;
}

const EMPTY: UploadDraft = {
  category: null,
  name: '',
  fileBase64: null,
  fileName: null,
  mimeType: null,
  size: null,
  ownerId: 'me',
  issueDate: null,
  expiryDate: null,
  notes: '',
  reminder: { days30: true, days7: true, days1: true },
};

interface Ctx {
  draft: UploadDraft;
  setDraft: (patch: Partial<UploadDraft>) => void;
  reset: () => void;
}

const UploadContext = createContext<Ctx | null>(null);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraftState] = useState<UploadDraft>(EMPTY);
  const setDraft = (patch: Partial<UploadDraft>) => setDraftState((d) => ({ ...d, ...patch }));
  const reset = () => setDraftState(EMPTY);
  return <UploadContext.Provider value={{ draft, setDraft, reset }}>{children}</UploadContext.Provider>;
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload outside provider');
  return ctx;
}
