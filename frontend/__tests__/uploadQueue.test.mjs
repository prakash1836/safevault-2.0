// In-process unit tests for UploadQueue behavior.
// We replicate the UploadQueue logic against a pure in-memory AsyncStorage
// mock so this file runs under plain Node (no jest / no expo).

const QUEUE_KEY = 'safevault.upload.queue.v1';

// -------- in-memory AsyncStorage --------
const mem = new Map();
const AsyncStorage = {
  async getItem(k) { return mem.has(k) ? mem.get(k) : null; },
  async setItem(k, v) { mem.set(k, String(v)); },
  async removeItem(k) { mem.delete(k); },
};

// -------- UploadQueue re-impl (mirrors src/services/uploadQueue.ts) --------
let flushChain = Promise.resolve();
async function withLock(fn) {
  const prev = flushChain;
  let release = () => {};
  flushChain = new Promise((r) => { release = r; });
  await prev;
  try { return await fn(); } finally { release(); }
}
async function readRaw() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
}
async function writeRaw(items) { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items)); }

const UploadQueue = {
  KEY: QUEUE_KEY,
  async list() { return withLock(readRaw); },
  async find(id) { const items = await withLock(readRaw); return items.find((i) => i.id === id) || null; },
  async findByDocId(docId) { const items = await withLock(readRaw); return items.find((i) => i.docId === docId) || null; },
  async enqueue(item) {
    return withLock(async () => {
      const now = new Date().toISOString();
      const items = await readRaw();
      const full = { ...item, queuedAt: now, lastAttemptAt: null, attempts: 0, lastError: null, status: 'pending' };
      items.push(full);
      await writeRaw(items);
      return full;
    });
  },
  async update(id, patch) {
    return withLock(async () => {
      const items = await readRaw();
      const idx = items.findIndex((i) => i.id === id);
      if (idx < 0) return null;
      items[idx] = { ...items[idx], ...patch };
      await writeRaw(items);
      return items[idx];
    });
  },
  async remove(id) {
    return withLock(async () => {
      const items = await readRaw();
      const next = items.filter((i) => i.id !== id);
      if (next.length !== items.length) await writeRaw(next);
    });
  },
  async removeByDocId(docId) {
    return withLock(async () => {
      const items = await readRaw();
      const next = items.filter((i) => i.docId !== docId);
      if (next.length !== items.length) await writeRaw(next);
    });
  },
  async count(status) {
    const items = await withLock(readRaw);
    return status ? items.filter((i) => i.status === status).length : items.length;
  },
  async clear() { return withLock(async () => { await AsyncStorage.removeItem(QUEUE_KEY); }); },
};

// -------- tiny test runner --------
let pass = 0, fail = 0;
async function t(name, fn) {
  await UploadQueue.clear();
  try { await fn(); console.log('OK  -', name); pass++; }
  catch (e) { console.log('FAIL-', name, ':', e.message); fail++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert'); }

function seed(docId = 'd1') {
  return {
    id: 'q_' + docId + '_' + Math.random().toString(36).slice(2, 8),
    docId, category: 'ID', fileName: 'v1.enc', localCipherPath: '/tmp/' + docId,
    mimeType: 'application/pdf', size: 100, fileHash: 'abc', version: 1,
  };
}

await t('enqueue writes and list() reads back', async () => {
  const a = await UploadQueue.enqueue(seed('d1'));
  assert(a.status === 'pending');
  assert(a.attempts === 0);
  assert(a.lastError === null);
  assert(a.lastAttemptAt === null);
  const items = await UploadQueue.list();
  assert(items.length === 1);
  assert(items[0].docId === 'd1');
});

await t('update() persists the patch', async () => {
  const a = await UploadQueue.enqueue(seed('d1'));
  await UploadQueue.update(a.id, { attempts: 3, status: 'failed', lastError: 'boom' });
  const found = await UploadQueue.find(a.id);
  assert(found.attempts === 3);
  assert(found.status === 'failed');
  assert(found.lastError === 'boom');
});

await t('remove() deletes exactly one item', async () => {
  const a = await UploadQueue.enqueue(seed('d1'));
  const b = await UploadQueue.enqueue(seed('d2'));
  await UploadQueue.remove(a.id);
  const items = await UploadQueue.list();
  assert(items.length === 1);
  assert(items[0].id === b.id);
});

await t('removeByDocId() removes all items for that docId', async () => {
  await UploadQueue.enqueue(seed('d1'));
  await UploadQueue.enqueue(seed('d1'));
  await UploadQueue.enqueue(seed('d2'));
  await UploadQueue.removeByDocId('d1');
  const items = await UploadQueue.list();
  assert(items.length === 1);
  assert(items[0].docId === 'd2');
});

await t('clear() empties the queue', async () => {
  await UploadQueue.enqueue(seed('d1'));
  await UploadQueue.enqueue(seed('d2'));
  await UploadQueue.clear();
  const items = await UploadQueue.list();
  assert(items.length === 0);
});

await t('concurrent enqueues via Promise.all yield correct final length', async () => {
  const N = 25;
  await Promise.all(Array.from({ length: N }, (_, i) => UploadQueue.enqueue(seed('d' + i))));
  const items = await UploadQueue.list();
  assert(items.length === N, `expected ${N}, got ${items.length}`);
  const ids = new Set(items.map((x) => x.docId));
  assert(ids.size === N, 'duplicates present');
});

await t('findByDocId + count', async () => {
  await UploadQueue.enqueue(seed('d1'));
  await UploadQueue.enqueue(seed('d2'));
  const one = await UploadQueue.findByDocId('d2');
  assert(one && one.docId === 'd2');
  const c = await UploadQueue.count();
  assert(c === 2);
  const cp = await UploadQueue.count('pending');
  assert(cp === 2);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
