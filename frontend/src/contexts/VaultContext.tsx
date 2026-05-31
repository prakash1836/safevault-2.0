import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { VaultDocument, VaultEvent, FamilyMember, DriveUsage } from '../types';
import { storage } from '../services/storage';
import { useAuth } from './AuthContext';
import { useNetwork } from './NetworkContext';
import { getKey, encryptBase64 } from '../services/encryption';
import { uploadToDrive, deleteFromDrive, fetchDriveQuota, saveEncryptedLocal } from '../services/drive';
import { scheduleReminders, cancelAllForId, initNotifications } from '../services/notifications';
import { getDocStatus } from '../utils/date';
import { addDays } from 'date-fns';

interface VaultCtx {
  docs: VaultDocument[];
  events: VaultEvent[];
  family: FamilyMember[];
  drive: DriveUsage;
  loading: boolean;
  uploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  addDoc: (
    input: Omit<VaultDocument, 'id' | 'createdAt' | 'updatedAt' | 'encrypted' | 'fileId'> & { fileBase64: string }
  ) => Promise<VaultDocument>;
  updateDoc: (id: string, patch: Partial<VaultDocument>) => Promise<void>;
  deleteDoc: (id: string) => Promise<void>;
  addEvent: (e: Omit<VaultEvent, 'id'>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  addFamily: (m: Omit<FamilyMember, 'id'>) => Promise<void>;
  updateFamily: (id: string, patch: Partial<FamilyMember>) => Promise<void>;
  removeFamily: (id: string) => Promise<void>;
  refreshDrive: () => Promise<void>;
  clearUploadError: () => void;
  retryFailedUploads: () => Promise<void>;
  vaultHealth: number;
  expiringCount: number;
}

const reminderIdsStore = new Map<string, string[]>();
const failedUploadsStore = new Map<string, { doc: VaultDocument; cipher: string; retryCount: number }>();

const VaultContext = createContext<VaultCtx | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [events, setEvents] = useState<VaultEvent[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [drive, setDrive] = useState<DriveUsage>({ total: 15 * 1024 * 1024 * 1024, used: 0, vault: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setDocs([]);
      setEvents([]);
      setFamily([]);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        await initNotifications();
        const [d, e, f, dr, seeded] = await Promise.all([
          storage.getDocs(),
          storage.getEvents(),
          storage.getFamily(),
          storage.getDrive(),
          storage.isSeeded(),
        ]);
        if (!seeded) {
          const seed = buildSeed();
          setDocs(seed.docs);
          setEvents(seed.events);
          setFamily(seed.family);
          await storage.setDocs(seed.docs);
          await storage.setEvents(seed.events);
          await storage.setFamily(seed.family);
          await storage.markSeeded();
        } else {
          setDocs(d);
          setEvents(e);
          setFamily(f);
        }
        setDrive(dr);
      } catch (e) {
        console.warn('Failed to load vault data:', e);
      } finally {
        setLoading(false);
      }
      // Try refresh quota in background
      try {
        const q = await fetchDriveQuota(user);
        setDrive(q);
        await storage.setDrive(q);
      } catch {}
    })();
  }, [user]);

  const clearUploadError = useCallback(() => setUploadError(null), []);

  const addDoc: VaultCtx['addDoc'] = useCallback(
    async (input) => {
      if (!user) throw new Error('Not logged in');
      setUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      
      try {
        const key = await getKey();
        if (!key) throw new Error('Missing encryption key. Please log out and log in again.');
        
        // Encrypt the file (25% progress)
        setUploadProgress(25);
        const cipher = encryptBase64(input.fileBase64, key);
        
        // Upload to Drive or save locally (50% progress)
        setUploadProgress(50);
        let fileId: string;
        let localUri: string | null = null;
        let uploadFailed = false;
        
        try {
          fileId = await uploadToDrive(user, input.name, cipher, input.mimeType || 'application/octet-stream');
          setUploadProgress(75);
          
          // For demo mode, fileId is the local file ID
          if (user.demo || fileId.startsWith('demo_')) {
            localUri = `${fileId}`;
          }
        } catch (uploadErr: any) {
          console.warn('Drive upload failed, saving locally:', uploadErr);
          uploadFailed = true;
          
          // Fallback to local storage
          const fakeId = 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          await saveEncryptedLocal(fakeId, cipher);
          fileId = fakeId;
          localUri = fakeId;
          setUploadProgress(75);
        }
        
        const now = new Date().toISOString();
        const id = 'doc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const doc: VaultDocument = {
          id,
          name: input.name,
          category: input.category,
          ownerId: input.ownerId,
          fileId,
          localUri,
          mimeType: input.mimeType,
          size: input.size,
          encrypted: true,
          issueDate: input.issueDate,
          expiryDate: input.expiryDate,
          notes: input.notes,
          reminder: input.reminder,
          createdAt: now,
          updatedAt: now,
        };
        
        // Store for retry if upload failed
        if (uploadFailed && !user.demo) {
          failedUploadsStore.set(doc.id, { doc, cipher, retryCount: 0 });
        }
        
        const next = [doc, ...docs];
        setDocs(next);
        await storage.setDocs(next);
        setUploadProgress(90);
        
        // Schedule reminders
        if (doc.expiryDate) {
          try {
            const ids = await scheduleReminders(doc.id, doc.name, doc.expiryDate, doc.reminder);
            reminderIdsStore.set(doc.id, ids);
          } catch (e) {
            console.warn('Failed to schedule reminders:', e);
          }
        }
        
        setUploadProgress(100);
        return doc;
      } catch (e: any) {
        const msg = e?.message || 'Upload failed';
        setUploadError(msg);
        throw new Error(msg);
      } finally {
        setUploading(false);
        setTimeout(() => setUploadProgress(0), 500);
      }
    },
    [user, docs]
  );

  const retryFailedUploads = useCallback(async () => {
    if (!user || user.demo || failedUploadsStore.size === 0) return;
    
    const entries = Array.from(failedUploadsStore.entries());
    for (const [docId, { doc, cipher, retryCount }] of entries) {
      if (retryCount >= 3) {
        console.warn(`Max retry attempts reached for ${doc.name}`);
        continue;
      }
      
      try {
        const fileId = await uploadToDrive(user, doc.name, cipher, doc.mimeType || 'application/octet-stream');
        
        // Update document with real Drive fileId
        const updatedDoc = { ...doc, fileId };
        const nextDocs = docs.map((d) => (d.id === docId ? updatedDoc : d));
        setDocs(nextDocs);
        await storage.setDocs(nextDocs);
        
        // Remove from failed uploads
        failedUploadsStore.delete(docId);
        console.log(`Successfully retried upload for ${doc.name}`);
      } catch (error) {
        console.warn(`Retry failed for ${doc.name}:`, error);
        failedUploadsStore.set(docId, { doc, cipher, retryCount: retryCount + 1 });
      }
    }
  }, [user, docs]);

  // Auto-retry failed uploads when network comes back online
  useEffect(() => {
    if (isOnline && user && !user.demo && failedUploadsStore.size > 0) {
      retryFailedUploads();
    }
  }, [isOnline, user, retryFailedUploads]);

  const updateDoc: VaultCtx['updateDoc'] = useCallback(
    async (id, patch) => {
      const next = docs.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d));
      setDocs(next);
      await storage.setDocs(next);
    },
    [docs]
  );

  const deleteDoc: VaultCtx['deleteDoc'] = useCallback(
    async (id) => {
      if (!user) return;
      const doc = docs.find((d) => d.id === id);
      const next = docs.filter((d) => d.id !== id);
      setDocs(next);
      await storage.setDocs(next);
      if (doc?.fileId) {
        try {
          await deleteFromDrive(user, doc.fileId, doc.localUri);
        } catch {}
      }
      const nids = reminderIdsStore.get(id);
      if (nids) {
        await cancelAllForId(nids);
        reminderIdsStore.delete(id);
      }
    },
    [user, docs]
  );

  const addEvent: VaultCtx['addEvent'] = useCallback(
    async (e) => {
      const id = 'evt_' + Date.now().toString(36);
      const ev: VaultEvent = { ...e, id };
      const next = [ev, ...events];
      setEvents(next);
      await storage.setEvents(next);
      const ids = await scheduleReminders(ev.id, ev.title, ev.date, ev.reminder);
      reminderIdsStore.set(ev.id, ids);
    },
    [events]
  );

  const deleteEvent: VaultCtx['deleteEvent'] = useCallback(
    async (id) => {
      const next = events.filter((e) => e.id !== id);
      setEvents(next);
      await storage.setEvents(next);
      const nids = reminderIdsStore.get(id);
      if (nids) {
        await cancelAllForId(nids);
        reminderIdsStore.delete(id);
      }
    },
    [events]
  );

  const addFamily: VaultCtx['addFamily'] = useCallback(
    async (m) => {
      const id = 'fam_' + Date.now().toString(36);
      const member: FamilyMember = { ...m, id };
      const next = [...family, member];
      setFamily(next);
      await storage.setFamily(next);
    },
    [family]
  );

  const updateFamily: VaultCtx['updateFamily'] = useCallback(
    async (id, patch) => {
      const next = family.map((f) => (f.id === id ? { ...f, ...patch } : f));
      setFamily(next);
      await storage.setFamily(next);
    },
    [family]
  );

  const removeFamily: VaultCtx['removeFamily'] = useCallback(
    async (id) => {
      const next = family.filter((f) => f.id !== id);
      setFamily(next);
      await storage.setFamily(next);
    },
    [family]
  );

  const refreshDrive = useCallback(async () => {
    if (!user) return;
    try {
      const q = await fetchDriveQuota(user);
      setDrive(q);
      await storage.setDrive(q);
    } catch {}
  }, [user]);

  const vaultHealth = useMemo(() => {
    if (docs.length === 0) return 0;
    let score = 0;
    for (const d of docs) {
      const s = getDocStatus(d.expiryDate);
      if (s === 'valid' || s === 'none') score += 1;
      else if (s === 'expiring_soon') score += 0.5;
    }
    const coverage = Math.min(docs.length / 8, 1);
    return Math.round(((score / docs.length) * 0.7 + coverage * 0.3) * 100);
  }, [docs]);

  const expiringCount = useMemo(
    () => docs.filter((d) => getDocStatus(d.expiryDate) === 'expiring_soon').length,
    [docs]
  );

  return (
    <VaultContext.Provider
      value={{
        docs,
        events,
        family,
        drive,
        loading,
        uploading,
        uploadProgress,
        uploadError,
        addDoc,
        updateDoc,
        deleteDoc,
        addEvent,
        deleteEvent,
        addFamily,
        updateFamily,
        removeFamily,
        refreshDrive,
        clearUploadError,
        retryFailedUploads,
        vaultHealth,
        expiringCount,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault outside provider');
  return ctx;
}

function buildSeed() {
  const now = new Date();
  const family: FamilyMember[] = [
    { id: 'me', name: 'You', relation: 'Self', avatar: 'https://images.unsplash.com/photo-1589006227094-fc2fcf082f87?w=160&q=80' },
    { id: 'fam_spouse', name: 'Maya', relation: 'Spouse', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&q=80', dob: '1990-04-14' },
    { id: 'fam_child', name: 'Aarav', relation: 'Child', avatar: 'https://images.pexels.com/photos/8217536/pexels-photo-8217536.jpeg?w=160&q=80', dob: '2018-09-02' },
  ];
  const mkDoc = (
    name: string,
    category: VaultDocument['category'],
    ownerId: string,
    expiresInDays: number | null,
    note?: string
  ): VaultDocument => ({
    id: 'doc_seed_' + Math.random().toString(36).slice(2, 8),
    name,
    category,
    ownerId,
    fileId: null,
    localUri: null,
    encrypted: true,
    mimeType: 'application/pdf',
    issueDate: addDays(now, -120).toISOString(),
    expiryDate: expiresInDays == null ? undefined : addDays(now, expiresInDays).toISOString(),
    notes: note,
    reminder: { days30: true, days7: true, days1: true },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  const docs: VaultDocument[] = [
    mkDoc('Passport', 'ID', 'me', 420, 'International travel document'),
    mkDoc('Health Insurance', 'Insurance', 'me', 18),
    mkDoc('Driving License', 'ID', 'me', -30, 'Needs renewal'),
    mkDoc('Car Insurance', 'Vehicle', 'me', 75),
    mkDoc('Life Insurance – Maya', 'Insurance', 'fam_spouse', 300),
    mkDoc('School Records – Aarav', 'Education', 'fam_child', null),
  ];
  const events: VaultEvent[] = [
    { id: 'evt_1', title: "Maya's Birthday", type: 'birthday', date: addDays(now, 12).toISOString(), ownerId: 'fam_spouse', reminder: { days30: false, days7: true, days1: true } },
    { id: 'evt_2', title: 'Dentist Appointment', type: 'appointment', date: addDays(now, 5).toISOString(), reminder: { days30: false, days7: true, days1: true } },
  ];
  return { docs, events, family };
}
