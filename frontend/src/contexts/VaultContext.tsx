import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { VaultDocument, VaultEvent, FamilyMember, DriveUsage } from '../types';
import { storage } from '../services/storage';
import { useAuth } from './AuthContext';
import { getKey, encryptBase64 } from '../services/encryption';
import { uploadToDrive, deleteFromDrive, fetchDriveQuota } from '../services/drive';
import { scheduleReminders, cancelAllForId, initNotifications } from '../services/notifications';
import { getDocStatus } from '../utils/date';
import { addDays } from 'date-fns';

interface VaultCtx {
  docs: VaultDocument[];
  events: VaultEvent[];
  family: FamilyMember[];
  drive: DriveUsage;
  loading: boolean;
  addDoc: (
    input: Omit<VaultDocument, 'id' | 'createdAt' | 'updatedAt' | 'encrypted' | 'fileId'> & { fileBase64: string }
  ) => Promise<VaultDocument>;
  updateDoc: (id: string, patch: Partial<VaultDocument>) => Promise<void>;
  deleteDoc: (id: string) => Promise<void>;
  addEvent: (e: Omit<VaultEvent, 'id'>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  addFamily: (m: Omit<FamilyMember, 'id'>) => Promise<void>;
  removeFamily: (id: string) => Promise<void>;
  refreshDrive: () => Promise<void>;
  vaultHealth: number;
  expiringCount: number;
}

const reminderIdsStore = new Map<string, string[]>();

const VaultContext = createContext<VaultCtx | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [events, setEvents] = useState<VaultEvent[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [drive, setDrive] = useState<DriveUsage>({ total: 15 * 1024 * 1024 * 1024, used: 0, vault: 0 });
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
      // Try refresh quota in background
      try {
        const q = await fetchDriveQuota(user);
        setDrive(q);
        await storage.setDrive(q);
      } catch {}
    })();
  }, [user]);

  const addDoc: VaultCtx['addDoc'] = useCallback(
    async (input) => {
      if (!user) throw new Error('Not logged in');
      const key = await getKey();
      if (!key) throw new Error('Missing encryption key');
      const cipher = encryptBase64(input.fileBase64, key);
      const fileId = await uploadToDrive(user, input.name, cipher, input.mimeType || 'application/octet-stream');
      const now = new Date().toISOString();
      const id = 'doc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const doc: VaultDocument = {
        id,
        name: input.name,
        category: input.category,
        ownerId: input.ownerId,
        fileId,
        localUri: user.demo ? fileId : null,
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
      const next = [doc, ...docs];
      setDocs(next);
      await storage.setDocs(next);
      if (doc.expiryDate) {
        const ids = await scheduleReminders(doc.id, doc.name, doc.expiryDate, doc.reminder);
        reminderIdsStore.set(doc.id, ids);
      }
      return doc;
    },
    [user, docs]
  );

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
        addDoc,
        updateDoc,
        deleteDoc,
        addEvent,
        deleteEvent,
        addFamily,
        removeFamily,
        refreshDrive,
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
