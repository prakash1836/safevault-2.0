// In-process unit tests for the UploadCoordinator sync-state machine.
// We mirror the coordinator logic against pure JS mocks for FolderManager,
// uploadToDrive, sqlite, saveEncryptedLocal, encryptBase64/getKey.

import CryptoJS from 'crypto-js';

// ---- in-memory AsyncStorage + UploadQueue (small copy) ----
const QUEUE_KEY = 'safevault.upload.queue.v1';
const mem = new Map();
const AsyncStorage = {
  async getItem(k) { return mem.has(k) ? mem.get(k) : null; },
  async setItem(k, v) { mem.set(k, String(v)); },
  async removeItem(k) { mem.delete(k); },
};
let chain = Promise.resolve();
async function withLock(fn) { const prev = chain; let rel = () => {}; chain = new Promise((r) => { rel = r; }); await prev; try { return await fn(); } finally { rel(); } }
async function readRaw() { const raw = await AsyncStorage.getItem(QUEUE_KEY); if (!raw) return []; try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; } }
async function writeRaw(items) { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items)); }
const UploadQueue = {
  async list() { return withLock(readRaw); },
  async enqueue(item) { return withLock(async () => { const items = await readRaw(); const full = { ...item, queuedAt: new Date().toISOString(), lastAttemptAt: null, attempts: 0, lastError: null, status: 'pending' }; items.push(full); await writeRaw(items); return full; }); },
  async update(id, patch) { return withLock(async () => { const items = await readRaw(); const idx = items.findIndex((i) => i.id === id); if (idx < 0) return null; items[idx] = { ...items[idx], ...patch }; await writeRaw(items); return items[idx]; }); },
  async remove(id) { return withLock(async () => { const items = await readRaw(); const next = items.filter((i) => i.id !== id); if (next.length !== items.length) await writeRaw(next); }); },
  async removeByDocId(docId) { return withLock(async () => { const items = await readRaw(); const next = items.filter((i) => i.docId !== docId); if (next.length !== items.length) await writeRaw(next); }); },
  async clear() { return withLock(async () => { await AsyncStorage.removeItem(QUEUE_KEY); }); },
};

// ---- mocks ----
let uploadShouldFail = false;
let uploadCallCount = 0;
const mockFolderManager = { async ensureDocFolder() { return 'folder_123'; } };
async function mockUploadToDrive(user, name, cipher, mime, opts) {
  uploadCallCount++;
  if (uploadShouldFail) throw new Error('network down');
  opts?.onProgress?.(0.5);
  opts?.onProgress?.(1);
  return 'file_abc';
}
const mockSqlite = { docs: new Map(), async upsertDocument(d) { this.docs.set(d.id, d); }, async getDocument(id) { return this.docs.get(id) || null; } };
async function mockSaveEncryptedLocal(id, cipher) { return `/cache/${id}.enc`; }
async function mockDeleteEncryptedLocal() {}
async function mockReadEncryptedLocal(path) { return 'CIPHER'; }
function mockEncryptBase64(b64, key) { return 'CIPHER::' + b64.slice(0, 4); }
async function mockGetKey() { return 'KEY'; }

// ---- Coordinator (mirror of src/services/uploadCoordinator.ts) ----
class Coordinator {
  constructor() { this.user = null; this.listeners = new Set(); this.processing = false; }
  setUser(u) { this.user = u; }
  subscribe(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
  emit(ev) { for (const l of this.listeners) { try { l(ev); } catch {} } }
  async submit({ doc }) {
    if (!this.user) throw new Error('no user');
    const user = this.user;
    const key = await mockGetKey();
    const cipher = mockEncryptBase64(doc.fileBase64, key);
    const localCipherPath = await mockSaveEncryptedLocal(doc.id, cipher);
    const now = new Date().toISOString();
    const durable = {
      id: doc.id, name: doc.name, category: doc.category, ownerId: doc.ownerId,
      fileId: null, localUri: localCipherPath, mimeType: doc.mimeType, size: doc.size,
      fileHash: doc.fileHash, encrypted: true, syncState: 'pending-upload', syncError: null,
      reminder: doc.reminder, createdAt: doc.createdAt || now, updatedAt: now,
    };
    try { await mockSqlite.upsertDocument({ ...durable, driveFolderId: null, version: 1 }); } catch {}
    const qItem = await UploadQueue.enqueue({
      id: 'q_' + doc.id + '_' + Date.now().toString(36),
      docId: doc.id, category: doc.category, fileName: 'v1.enc',
      localCipherPath, mimeType: doc.mimeType || 'application/octet-stream',
      size: doc.size || 0, fileHash: doc.fileHash ?? null, version: 1,
    });
    this.emit({ docId: doc.id, state: 'pending-upload' });
    const attempt = await this.attemptOne(user, qItem, cipher);
    return { doc: durable, attempt };
  }
  async attemptOne(user, item, cipherOverride) {
    await UploadQueue.update(item.id, { status: 'in-progress' });
    this.emit({ docId: item.docId, state: 'uploading', progress: 0 });
    try {
      const folderId = await mockFolderManager.ensureDocFolder(user, item.docId, item.category);
      const cipher = cipherOverride ?? await mockReadEncryptedLocal(item.localCipherPath);
      if (!cipher) throw new Error('cache missing');
      const fileId = await mockUploadToDrive(user, item.fileName, cipher, item.mimeType, {
        onProgress: (p) => this.emit({ docId: item.docId, state: 'uploading', progress: p }),
      });
      try {
        const existing = await mockSqlite.getDocument(item.docId);
        if (existing) await mockSqlite.upsertDocument({ ...existing, fileId, driveFolderId: folderId, updatedAt: new Date().toISOString() });
      } catch {}
      await UploadQueue.remove(item.id);
      this.emit({ docId: item.docId, state: 'synced', progress: 1, fileId, driveFolderId: folderId, localUri: item.localCipherPath });
      return { status: 'synced', fileId, driveFolderId: folderId };
    } catch (e) {
      const msg = e?.message || 'Upload failed';
      const attempts = item.attempts + 1;
      await UploadQueue.update(item.id, { status: 'failed', attempts, lastAttemptAt: new Date().toISOString(), lastError: msg });
      this.emit({ docId: item.docId, state: attempts >= 5 ? 'failed' : 'pending-upload', error: msg });
      return { status: 'pending', error: msg };
    }
  }
  async cancelForDoc(docId) {
    const items = await UploadQueue.list();
    const gone = items.filter((i) => i.docId === docId);
    if (gone.length === 0) return;
    await UploadQueue.removeByDocId(docId);
    for (const g of gone) { if (g.localCipherPath) { try { await mockDeleteEncryptedLocal(g.localCipherPath); } catch {} } }
    this.emit({ docId, state: 'deleted' });
  }
}

// ---- runner ----
let pass = 0, fail = 0;
async function t(name, fn) { await UploadQueue.clear(); uploadShouldFail = false; uploadCallCount = 0; try { await fn(); console.log('OK  -', name); pass++; } catch (e) { console.log('FAIL-', name, ':', e.message); fail++; } }
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

function docInput(id = 'd1') {
  return { id, name: 'Passport', category: 'ID', ownerId: 'me', mimeType: 'application/pdf', size: 10, fileHash: 'hash', reminder: { days30: true, days7: true, days1: true }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), fileBase64: 'AAAA' };
}

await t('submit success: pending-upload → uploading → synced, queue cleared', async () => {
  const c = new Coordinator();
  c.setUser({ id: 'u1' });
  const events = [];
  c.subscribe((ev) => events.push(ev.state));
  const res = await c.submit({ doc: docInput('d1') });
  assert(res.attempt.status === 'synced');
  assert(res.attempt.fileId === 'file_abc');
  const items = await UploadQueue.list();
  assert(items.length === 0, 'queue should be empty on success, got ' + items.length);
  assert(events[0] === 'pending-upload', 'first event: ' + events[0]);
  assert(events.includes('uploading'), 'missing uploading state');
  assert(events[events.length - 1] === 'synced', 'last event: ' + events[events.length - 1]);
});

await t('submit failure: queue retained, status=failed, attempts=1, emits pending-upload (attempts<5)', async () => {
  const c = new Coordinator();
  c.setUser({ id: 'u1' });
  const events = [];
  c.subscribe((ev) => events.push(ev));
  uploadShouldFail = true;
  const res = await c.submit({ doc: docInput('d2') });
  assert(res.attempt.status === 'pending', 'attempt should be pending');
  const items = await UploadQueue.list();
  assert(items.length === 1, 'queue should retain item, got ' + items.length);
  assert(items[0].status === 'failed');
  assert(items[0].attempts === 1, 'attempts=' + items[0].attempts);
  assert(items[0].lastError && items[0].lastError.length > 0);
  const last = events[events.length - 1];
  assert(last.state === 'pending-upload', 'last emit state=' + last.state + ' (expected pending-upload since attempts<5)');
  assert(last.error && last.error.includes('network'));
});

await t('submit never rejects on upload failure', async () => {
  const c = new Coordinator();
  c.setUser({ id: 'u1' });
  uploadShouldFail = true;
  let threw = false;
  try { await c.submit({ doc: docInput('d3') }); } catch { threw = true; }
  assert(!threw, 'submit should not throw on upload failure');
});

await t('cancelForDoc removes queue item and emits deleted', async () => {
  const c = new Coordinator();
  c.setUser({ id: 'u1' });
  uploadShouldFail = true; // keep item in queue
  await c.submit({ doc: docInput('d4') });
  const before = await UploadQueue.list();
  assert(before.length === 1);
  const events = [];
  c.subscribe((ev) => events.push(ev));
  await c.cancelForDoc('d4');
  const after = await UploadQueue.list();
  assert(after.length === 0, 'queue not cleared');
  assert(events.some((e) => e.state === 'deleted' && e.docId === 'd4'), 'no deleted event emitted');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
