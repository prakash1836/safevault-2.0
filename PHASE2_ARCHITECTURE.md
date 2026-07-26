# SafeVault — Phase 2 Architecture Design

**Status**: DRAFT for review • **No code will be written until this document is approved**
**Author**: E1 • **Date**: Jul 2026
**Scope**: Google Drive Storage Engine, Metadata Management, Folder Management, Synchronization
**Discipline**: reuse the existing architecture, minimise churn, preserve UI/navigation/testIDs, keep zero-knowledge encryption intact

---

## 0. Design Principles (non-negotiable)

1. **Zero-knowledge preserved**. Every byte we upload to Drive — files *and* metadata — is AES-256-CBC encrypted with the user's PBKDF2-derived key (`services/encryption.ts` today). Drive stores ciphertext + minimal envelope; Google never sees plaintext.
2. **Reuse first**. `drive.ts`, `storage.ts`, `encryption.ts`, `notifications.ts`, `VaultContext` all stay. New capability is delivered as *thin services above* the current primitives.
3. **UI/navigation untouched**. `home.tsx`, `docs.tsx`, `document/[id].tsx`, `upload/*` continue to consume `VaultContext` exactly as they do today. Sync is invisible to screens beyond an optional `syncStatus` field.
4. **Offline-first**. Local (AsyncStorage) is the source of truth for reads while offline; Drive is the durable store; the two reconcile through the SyncManager.
5. **Idempotent operations**. Any Drive mutation can be retried without duplicating files or corrupting the manifest.
6. **Small blast radius**. No changes to authentication, encryption keys, notification schema, or the current storage keys. New keys are added under `safevault.*`.

---

## 1. Folder Hierarchy (on Google Drive)

Because SafeVault uses the OAuth `drive.file` scope, we only ever see/touch files SafeVault itself creates. The hierarchy is therefore fully owned by us and invisible to the rest of Drive.

```
My Drive/
└── SafeVault/                          ← root, tag: safevault.root=1
    ├── manifest/
    │   ├── metadata.json               ← latest encrypted manifest (see §2)
    │   └── metadata.json.bak           ← previous good snapshot (rotating)
    ├── docs/
    │   ├── <docId>/                    ← one folder per document
    │   │   ├── v1.enc                  ← ciphertext of v1
    │   │   ├── v2.enc                  ← optional (§12 versioning)
    │   │   └── thumb.enc               ← optional encrypted thumbnail
    │   └── ...
    ├── events/                         ← reserved for future event attachments
    └── family/                         ← reserved for shared vaults (§15)
        └── <shareId>/
            └── ...
```

**Why this shape**
- `SafeVault/` is a single, discoverable anchor. We find/create it once per session and cache its `fileId` in AsyncStorage.
- Per-doc subfolder (`docs/<docId>/`) makes rename-with-history, versioning, and deletion **atomic per document** — no orphans, no directory scans on delete.
- `manifest/` is its own folder so the write path for metadata never races with file uploads and lookups are O(1).
- `.enc` suffix is a signal only (no meaningful mime); Drive itself sees `application/octet-stream`.

**Drive tags on every SafeVault file** (Drive `appProperties`, not visible outside our OAuth scope):
| Key | Value | Purpose |
|---|---|---|
| `safevault` | `1` | discovery filter |
| `safevault.role` | `root` \| `manifest` \| `doc` \| `thumb` \| `event` | typing |
| `safevault.docId` | `<docId>` | for doc/thumb files, cross-links to manifest |
| `safevault.version` | `<int>` | version tag (see §12) |
| `safevault.hash` | `<sha256>` | integrity check |
| `safevault.updatedAt` | ISO8601 | tie-break during conflict resolution |

**Files/paths we never touch**: any Drive content the user created outside SafeVault. The `drive.file` scope enforces this at the API level — we couldn't touch them even if we wanted to.

---

## 2. `metadata.json` Schema (encrypted on Drive)

`metadata.json` is the **single manifest of the vault**: what documents exist, their properties, and which Drive files back them. It is the encrypted mirror of the local Vault state that survives reinstalls, powers multi-device sync, and enables rebuild-from-Drive after data loss.

**On-disk shape (before encryption)**

```jsonc
{
  "schemaVersion": 1,                    // bump when shape changes
  "vaultId": "sv_<userId>",              // stable per user
  "revision": 42,                        // monotonically increasing counter
  "updatedAt": "2026-07-26T14:53:00Z",
  "updatedBy": {                         // last writer (device attribution)
    "deviceId": "dev_a1b2c3",
    "deviceName": "Pixel 8 · Chrome",
    "platform": "android|ios|web"
  },
  "clock": { "vector": { "dev_a1b2c3": 42, "dev_z9y8": 7 } }, // §10
  "documents": [
    {
      "id": "doc_abc123",
      "name": "Passport",
      "category": "ID",
      "ownerId": "me",
      "driveFolderId": "1AbC…",          // docs/<docId>/
      "current": {
        "version": 3,
        "fileId": "1XyZ…",               // Drive fileId of v3.enc
        "fileHash": "9f0a…sha256",       // SHA-256 of PLAINTEXT bytes
        "size": 154321,
        "mimeType": "application/pdf",
        "uploadedAt": "2026-07-25T09:14:00Z"
      },
      "history": [                       // §12 — bounded, newest-last
        { "version": 1, "fileId": "…", "fileHash": "…", "size": 148900, "uploadedAt": "…" },
        { "version": 2, "fileId": "…", "fileHash": "…", "size": 149600, "uploadedAt": "…" }
      ],
      "thumb": { "fileId": "…", "hash": "…" } | null,
      "issueDate": "2020-06-01",
      "expiryDate": "2030-06-01",
      "notes": "…",
      "reminder": { "days30": true, "days7": true, "days1": true },
      "createdAt": "…", "updatedAt": "…",
      "deleted": false,                  // soft-delete tombstone (§9)
      "deletedAt": null
    }
  ],
  "events": [ /* mirror of VaultEvent */ ],
  "family": [ /* mirror of FamilyMember */ ]
}
```

**Notes**
- Reminder-notification IDs live only in `safevault.notifications.map.v1` (device-local) — they are per-device Expo tokens and must NOT enter the manifest.
- `fileHash` reuses the SHA-256 already computed in Phase 1 (see `upload/file.tsx#sha256OfBase64`).
- `history` is capped (default 3 versions kept, oldest pruned) — see §12.
- Encrypted envelope on Drive (the actual `metadata.json` file body) is:
  `"safevault:v1:" + hex(iv) + ":" + base64(ciphertext)` — same envelope shape our per-file encryption uses today.

**Backward compatibility**: `schemaVersion` allows the client to upgrade the manifest on the fly. Newer readers must tolerate unknown fields (drop them silently); older readers refuse to write when `schemaVersion > SUPPORTED`.

---

## 3. `FolderManager` Responsibilities

**File**: `src/services/folderManager.ts` (new — thin module, ~150 LOC)

**Purpose**: know how to find or create every folder in §1, and cache Drive folder IDs locally.

**Public API**
| Method | Description |
|---|---|
| `ensureRoot(user)` | Locate or create `SafeVault/`; cache `rootId` in AsyncStorage. |
| `ensureSubfolder(user, role, name?)` | For `manifest`, `docs`, `events`, `family`. Idempotent. |
| `ensureDocFolder(user, docId)` | Create `docs/<docId>/` on first upload; return `fileId`. |
| `getRootId(user)` | Read from cache; verify existence lazily on first mutation. |
| `renameDocFolder(user, docId, newName?)` | Not needed — we key by `docId`, not by name (rename is a manifest-only change, see §9). |
| `deleteDocFolder(user, docId)` | Trash the per-doc folder; Drive cascades. |

**Storage keys added**
- `safevault.drive.rootId` → string
- `safevault.drive.subfolders` → `{ manifest: id, docs: id, events: id, family: id }`
- `safevault.drive.docFolders` → `Record<docId, driveFolderId>`

**Reuse**: `FolderManager` uses only the Drive REST endpoints already permitted by our scope: `POST /drive/v3/files` (create folder with `mimeType: 'application/vnd.google-apps.folder'` + `parents`), `GET /drive/v3/files?q=` (list to find existing). No new library, no new scope.

---

## 4. `MetadataManager` Responsibilities

**File**: `src/services/metadataManager.ts` (new — ~200 LOC)

**Purpose**: read/write/merge the encrypted manifest atomically. This is the "database driver" for the vault manifest.

**Public API**
| Method | Description |
|---|---|
| `load(user)` | Download `manifest/metadata.json`, decrypt with the existing PBKDF2 key, parse, validate against `schemaVersion`. On absence → return an initial empty manifest. |
| `save(user, manifest)` | Bump `revision` + `updatedAt` + `updatedBy` + local vector-clock component, encrypt, upload with **manifest lock** (see below). Rotate previous body into `metadata.json.bak`. |
| `merge(local, remote)` | Field-level three-way merge (see §10 conflict resolution). Returns a new manifest + a list of decisions taken for the audit log. |
| `applyDocUpsert(manifest, doc)` | Pure helper: insert/replace a document entry. Updates `updatedAt`, appends to `history` when file contents changed. |
| `applyDocSoftDelete(manifest, docId)` | Set `deleted=true`, `deletedAt=now`. |
| `applyDocRename(manifest, docId, newName)` | Manifest-only; no file/folder move needed. |
| `pruneHistory(manifest, keep=3)` | Trim old versions; produces a list of orphan Drive fileIds for GC (see §13). |
| `validate(manifest)` | Structural + referential checks. |

**Manifest lock (soft, optimistic)**
- Every `save` sends `If-Match: <etag>` (Drive returns `etag` on GET) → on 412 Precondition Failed, we re-load, re-merge, retry (bounded: 3 attempts).
- If the concurrent write happened on the same device (impossible today; guardrail for the future), we serialise through an in-process promise queue.

**Backup file `metadata.json.bak`**
- Written **before** the new manifest — same encrypted envelope, previous content.
- Used only by disaster-recovery in §13.

**Reuse**: purely composes `drive.ts` (upload/download by name+parent), `encryption.ts` (encryptJSON/decryptJSON — already present).

---

## 5. `DriveService` Responsibilities

**File**: `src/services/drive.ts` — **existing file, extended, not replaced**

Today `drive.ts` exposes:
`uploadToDrive`, `deleteFromDrive`, `fetchDriveQuota`, `saveEncryptedLocal`, `readEncryptedLocal`, `deleteEncryptedLocal`.

Phase 2 adds the following (all backwards-compatible):

| New export | Purpose |
|---|---|
| `downloadFromDrive(user, fileId, opts?): Promise<string>` | GET `.../files/<id>?alt=media`, return ciphertext string. |
| `createFolderOnDrive(user, name, parentId?)` | Used by `FolderManager`. |
| `findFileOnDrive(user, { name?, parentId?, appProperties? })` | Discover the SafeVault root, manifest, and per-doc folders. |
| `updateFileOnDrive(user, fileId, { body?, appProperties?, name? }, opts?)` | Underlying PATCH used by `MetadataManager` (multipart if `body` present). |
| `resumableUpload(user, fileName, ciphertext, mimeType, opts)` | Chunked upload used automatically when `bytes > RESUMABLE_UPLOAD_THRESHOLD_BYTES`. Stub reserved in Phase 1. |
| `refreshAccessToken(user)` (optional; see §13) | Wraps `GoogleSignin.getTokens()` for silent 401 recovery. |

`uploadToDrive` gains one small internal branch: when `bytes > RESUMABLE_UPLOAD_THRESHOLD_BYTES` it delegates to `resumableUpload`; otherwise it stays the fast multipart path we already ship. The signature does **not** change.

**Web caveat (already documented from Phase 1)**: `expo-file-system.getInfoAsync` is not available on web, so `saveEncryptedLocal`/`readEncryptedLocal` are guarded with `Platform.OS !== 'web'`. This is a Phase-2 cleanup, not a Drive concern.

---

## 6. `SyncManager` Responsibilities

**File**: `src/services/syncManager.ts` (new — ~250 LOC)

**Purpose**: orchestrator that reconciles the on-device Vault (AsyncStorage) with the Drive manifest and file objects. All screens continue to talk to `VaultContext`; only `VaultContext` talks to `SyncManager`.

**States**
```
idle → syncing → idle
        ↘ error(→ retry backoff) ↘ offline (paused)
```

**Triggers**
1. **App start** (after auth): full sync (`pullThenPush`).
2. **Foreground resume** (>2 min idle): incremental sync.
3. **Local mutation** (add/update/delete doc/event): debounced push (default 800ms) → `save`.
4. **Manual pull** (pull-to-refresh, already wired on home + docs): full pull.
5. **Reconnect after offline**: run the queued operation log (§11).

**Public API (consumed by VaultContext)**
| Method | Description |
|---|---|
| `bootstrap(user)` | Ensures folders, hydrates local from Drive if manifest exists; otherwise seeds Drive from local. |
| `pull(user)` | Loads remote manifest → merges into local state → schedules missing thumbnail/history downloads lazily. |
| `push(user)` | Snapshots current local state → merges into remote → uploads pending files → writes manifest. |
| `enqueue(op)` | Append to persistent op-log (upload/rename/delete). |
| `subscribeStatus(cb)` | Emits `{status, lastSyncAt, error?, pending: n}` — surfaced in Profile / a subtle indicator (no redesign; reuses the existing "Google Drive" card on Home). |

**What the SyncManager does NOT do**
- No new UI. No new screens. No forced modal on conflict — automatic resolution per §10, with a lightweight "last-writer wins with backup" fallback.
- No background service on native — sync runs foreground only. This is intentional for the MVP and matches user permission expectations.

---

## 7. Upload Flow (end-to-end)

The current upload flow (`upload/type → file → details → review → addDoc`) is preserved. `VaultContext.addDoc` is refactored *internally* to route through the new services:

```
User taps “Encrypt & Save” (review.tsx)
        │
        ▼
VaultContext.addDoc(input)
        │
        ├─ set uploading=true, uploadProgress=0
        │
        ├─ 1. getKey()                            ← unchanged
        ├─ 2. cipher = encryptBase64(b64, key)   ← unchanged
        │
        ├─ 3. FolderManager.ensureRoot(user)
        ├─ 4. FolderManager.ensureSubfolder('docs')
        ├─ 5. folderId = FolderManager.ensureDocFolder(user, docId)
        │
        ├─ 6. DriveService.uploadToDrive(user, 'v1.enc', cipher, mime, { parentId: folderId, onProgress })
        │       → routes to resumableUpload() automatically when > 5 MB
        │       → tagged with safevault.role=doc, docId, version=1, hash, updatedAt
        │
        ├─ 7. On network failure → SyncManager.enqueue({ op:'upload', ... }) + saveEncryptedLocal(cipher)
        │       → user gets today's error banner + Retry (Phase 1 UX preserved)
        │
        ├─ 8. localDoc = build VaultDocument with fileId, driveFolderId, fileHash, version=1
        ├─ 9. storage.setDocs([...docs, localDoc])   ← AsyncStorage first (offline-safe)
        │
        ├─ 10. SyncManager.push() (debounced)
        │       → MetadataManager.load()
        │       → applyDocUpsert(manifest, localDoc)
        │       → MetadataManager.save() with If-Match retry
        │
        ├─ 11. scheduleReminders(...) + persistReminderStore()  ← unchanged (Phase 1)
        │
        └─ 12. uploading=false, uploadProgress=1
```

**UI impact**: none beyond the progress bar & retry we already added.
**Testability**: existing test-IDs (`review-submit-btn`, `review-progress-*`, `doc-card-*`) unchanged.

---

## 8. Download Flow

Two situations trigger a download:

**(a) User opens a document from `document/[id].tsx` and taps Download** (already exists in UI)
```
User taps Download
        │
        ▼
1. Look up VaultDocument.current.fileId locally
2. Try readEncryptedLocal(localUri) first (offline-friendly)
     ├─ present → decrypt → save-to-Files / share
     └─ absent  → DriveService.downloadFromDrive(user, fileId, { onProgress })
                → verify sha256(plaintext) === fileHash (integrity)
                → cache to encrypted local file
                → decrypt in memory → save-to-Files / share
3. On mismatch → surface a subtle warning + still return the file (never silently fail)
```

**(b) Multi-device / reinstall — a doc known to manifest but not on this device**
```
SyncManager.pull() populates localDoc with fileId + hash but no localUri.
document/[id].tsx renders "Fetching…" on preview.
downloadFromDrive runs lazily on first tap and caches thereafter.
```

**Streamed download**: for files > 5 MB we use `alt=media` with `Range:` headers so `onProgress` reports realistic percentages; smaller files go single-shot.

---

## 9. Rename & Delete Flow

**Rename (name/metadata edits)** — happens via `document/[id].tsx#edit-save-btn` (existing UI):
```
VaultContext.updateDoc(id, patch)
   ├─ local: mutate docs[], storage.setDocs()
   ├─ notifications: re-schedule if expiry/reminder changed (Phase 1 — unchanged)
   └─ SyncManager.push():
       └─ MetadataManager.applyDocRename() → save()
            (NO file/folder rename on Drive — the Drive layer only knows docId. This is deliberate: rename is metadata-only, so it costs one manifest write, is instantly consistent, and cannot leave orphans.)
```

**Delete** — from `document/[id].tsx#doc-delete-btn`:
```
VaultContext.deleteDoc(id)
   ├─ Phase-A (soft, immediate):
   │     ├─ manifest: applyDocSoftDelete(docId)  ← tombstone
   │     ├─ local:    remove from docs[]         ← UI updates instantly
   │     ├─ notifications: clearRemindersFor(id) (Phase 1 — unchanged)
   │     └─ SyncManager.push()
   │
   └─ Phase-B (hard, deferred by GC ≥ 24h):
         ├─ FolderManager.deleteDocFolder(user, docId)   ← trash docs/<docId>/
         └─ MetadataManager.pruneHistory(...)
```

Two-phase delete gives us:
- **Undo window**: manifest tombstone + retained ciphertext → a future "Recently deleted" feature is a manifest query away with **no schema change**.
- **Multi-device safety**: if Device A deletes while Device B is uploading a new version to the same doc, the tombstone loses the conflict resolution (see §10 rules) — the doc reappears on both devices, never silently annihilated.

---

## 10. Conflict Resolution

We use **document-level field merging** driven by a **vector clock per device**, not raw last-writer-wins.

**Vector clock**
- Each device has a stable `deviceId` (`safevault.device.id`, generated once, persisted). Human-readable `deviceName` derived from `Device.modelName + platform`.
- Every `save` bumps `manifest.clock.vector[deviceId] += 1`.
- Compare two manifests A and B by their vectors:
  - `A ≤ B` → B is newer, replace A.
  - `B ≤ A` → A is newer, keep A.
  - Otherwise → **concurrent** → run field-level merge.

**Field-level merge policy** (per document, applied only on concurrent writes):
| Field | Policy |
|---|---|
| `name`, `notes`, `issueDate`, `expiryDate`, `category`, `ownerId`, `reminder.*` | Last-writer-wins by `updatedAt`; both edits kept in `mergeAudit` for user-visible reconciliation (see below) |
| `current` (the file itself) | **Both wins**: keep newer `uploadedAt` as `current`; the loser becomes `history[n]`. No plaintext ever discarded. |
| `deleted=true` on one, edit on the other | **Edit wins** — tombstone reversed; deletion must be re-applied intentionally. |
| `deleted=true` on both | Merged; `deletedAt` = later of the two. |
| `family` array | Union by member `id`; last-writer-wins per member. |

**Merge audit trail** (`mergeAudit`, capped at last 20): a small, encrypted, per-doc log of `{ ts, deviceId, field, resolution }` shown only if the user explicitly opens "Sync details" in Profile (a Phase-2.1 opt-in surface — the base MVP does not need to expose it).

**No user-facing conflict prompt for MVP**: policies above are safe defaults. A visible "Conflicts to review" affordance can appear later without any manifest change.

---

## 11. Offline Behavior

**Reads while offline** — no change to today's UX:
- All VaultContext-consumed data comes from AsyncStorage; screens render instantly.
- Encrypted files that were previously downloaded are cached locally (`saveEncryptedLocal`) and available for open/download without a network round-trip.
- Files never downloaded on this device show a subtle "Not downloaded yet" state on the preview (reuses existing empty/skeleton components — no new component).

**Writes while offline** — persistent op-log:
- New AsyncStorage key `safevault.sync.opLog.v1` (append-only queue):
  ```json
  [
    { "id": "op_1", "op": "upload", "docId": "…", "cipherPath": "…", "attempts": 0, "queuedAt": "…" },
    { "id": "op_2", "op": "manifest.upsertDoc", "payload": { … } },
    { "id": "op_3", "op": "manifest.softDelete", "docId": "…" }
  ]
  ```
- Every mutation goes through `SyncManager.enqueue(op)` → executes immediately if online; otherwise it sits until reconnect.
- Reconnect path (detected via `@react-native-community/netinfo` **only if already installed**; otherwise we use a lightweight polling probe on the manifest endpoint — no new dependency required): flush op-log in order.

**Guarantees**
- No lost writes on airplane mode.
- No double-writes on reconnect (each op has a stable `id` and idempotent handler).
- Local encryption always runs regardless of network; ciphertext is what's queued, never plaintext.

---

## 12. Versioning Strategy

**Model**: monotonically increasing integer `version` per document. Every "replace file" or "re-upload after edit" produces a new version.

**Rules**
1. New upload = `version = current.version + 1`. Prior `current` is pushed onto `history`.
2. Drive file paths follow `docs/<docId>/v<N>.enc` — human-readable and greppable via the manifest.
3. `history.length` is capped by a constant `HISTORY_MAX_VERSIONS = 3` (configurable, alongside `MAX_UPLOAD_SIZE_MB`).
4. When `history.length > cap`, `pruneHistory` produces a list of fileIds → the SyncManager schedules a low-priority GC pass to delete them from Drive.
5. Client never overwrites in place — every version is its own Drive file. Simplifies rollback, undelete, and multi-device consistency.

**User-visible surface (opt-in, later)**: a "Version history" section on `document/[id].tsx` — same page, no new route. For MVP we ship the mechanic; the UI toggle is deferred.

**Manifest history and file history stay in sync** via a single-writer discipline: only `MetadataManager.applyDocUpsert()` mutates `history` and only the SyncManager mutates the corresponding Drive files.

---

## 13. Error Recovery

**Categories & handling**
| Failure | Detection | Recovery |
|---|---|---|
| **Transient network** (offline, 5xx, aborted upload) | `xhr.onerror`, `fetch` throw | Op stays in the log; exponential backoff (2s → 4s → 8s → 30s cap); retry limit is per-op, not per-session |
| **401 Unauthorized** | Drive returns 401 | `refreshAccessToken(user)` via `GoogleSignin.getTokens()`; retry once; if still 401 → prompt re-login on next foreground (no forced logout) |
| **412 Precondition Failed** on manifest write | `If-Match` mismatch | Re-load remote manifest → merge → save; up to 3 iterations, then defer & report |
| **404 file gone** for a known `fileId` | GET/PATCH returns 404 | Mark local doc `current.missing = true`; UI shows a subtle "File not found on Drive" chip; SyncManager attempts to reconstruct from `history` if any version still exists; otherwise surface a one-tap "Re-upload from device" using the local ciphertext (`localUri`) if present |
| **Storage quota exceeded** (403 `storageQuotaExceeded`) | Drive body signal | Non-blocking banner on Home reusing the existing warning surface; op stays queued; user is directed to free space |
| **Manifest corruption / decrypt failure** | `decryptJSON` throw | Fall back to `metadata.json.bak`; write an incident marker into `safevault.sync.lastError` for diagnostics; if `.bak` also fails, rebuild manifest from local + Drive listing (scan for tagged files) |
| **Local disk full** during download | `FileSystem.writeAsStringAsync` throw | Skip local cache; stream & decrypt in memory only; retry cache on next open |
| **Integrity mismatch** (`fileHash` ≠ observed) | After download | Refuse the plaintext delivery once; automatic re-download; if still mismatched → alert user via existing error banner with a one-tap "Report" (opt-in) |

**Central sink**: every failure funnels through `SyncManager.recordError({ op, kind, message })` which persists to `safevault.sync.errorLog.v1` (bounded ring buffer, 100 entries). No PII; ciphertext-only diagnostics — safe for a future "Send diagnostics" flow.

---

## 14. Multi-Device Synchronization

**How it works**
1. Each device runs the same client with a stable `deviceId` (persisted in AsyncStorage).
2. `bootstrap(user)` on first launch after login:
   - Load remote manifest (if exists) via `MetadataManager.load`.
   - Merge into empty local state (§10 rules apply, but there's no conflict on empty).
   - Enqueue lazy downloads for any doc missing local ciphertext.
3. On every foreground resume (>2 min idle) or explicit pull-to-refresh, incrementally reconcile.
4. On every local mutation, debounce-push (800ms) — so a burst of 3 quick edits = 1 manifest write.

**Two devices online simultaneously**
- Concurrent writes are detected via vector clocks (§10). Field-level merge is deterministic and identical on both sides — they converge to the same manifest without a "master".
- File uploads never collide because per-doc versions are additive; two versions produced concurrently just co-exist in `history` with the older `uploadedAt` sinking to a lower slot.

**Deletion propagation**
- Tombstone on Device A → next pull on Device B removes the doc locally + cancels reminders.
- Undo/reversal from Device C editing before pulling → §10 rule ("edit wins over delete") revives the doc on both devices.

**Battery/data considerations**
- Sync only runs foreground; no wake-locks; no background fetch registered.
- Manifest is small (< 20 KB even at 500 docs) — cheap to pull.
- File downloads are lazy (on demand) — the manifest tells us they exist; bytes are pulled only when the user actually opens or downloads a document.

---

## 15. Family Vault & Shared Folders (Future — accommodated, not built)

The Phase 2 design leaves room for shared vaults **without any schema change** later:

**Shape**
- A shared vault is a separate manifest under `SafeVault/family/<shareId>/manifest/metadata.json`, encrypted with a **shared key** (not the personal PBKDF2 key).
- The personal manifest gains a top-level `shares: [{ shareId, role, keyWrapped }]` array — `keyWrapped` is the shared key encrypted with the user's personal key. On read, the client unwraps and can then decrypt the shared manifest.
- Documents in a shared vault carry `ownerId` referencing a `FamilyMember` — reusing the existing `family` type.

**Access grants**
- The vault creator generates a shared key, wraps it once per invitee (using invitee's public key, obtained out-of-band or via a small "invite code" flow), and appends to the shared manifest's `members`.
- Revocation = rotate shared key + rewrap for remaining members + re-encrypt shared manifest. Documents remain readable because they're keyed to the shared key at time of write (a future "forward-secrecy" upgrade could rewrap docs too — deferrable).

**Why this works today**
- `FolderManager` already reserves `family/` in §1.
- `MetadataManager` is agnostic to which manifest it operates on — pointing it at a different Drive path is a parameter.
- `SyncManager` runs one loop per manifest → shared vaults are additional loops.
- UI already surfaces `FamilyMember` in Owner selection; ownership by shared member is the only cross-cutting concept.

**Nothing in Phase 2 blocks Phase 4 family sharing**; every choice above (per-doc folder, versioned files, vector clocks, tombstones) transfers directly.

---

## Files Introduced / Modified (summary — for scoping)

| File | Kind | Purpose | Approx LOC |
|---|---|---|---|
| `src/services/folderManager.ts` | **new** | §3 folder resolution & caching | ~150 |
| `src/services/metadataManager.ts` | **new** | §4 manifest lifecycle + merge | ~250 |
| `src/services/syncManager.ts` | **new** | §6 orchestrator + op-log | ~300 |
| `src/services/drive.ts` | modified | +download/find/update/resumable helpers (§5) | +150 |
| `src/services/storage.ts` | modified | +keys for rootId, subfolders, opLog, deviceId, errorLog | +30 |
| `src/contexts/VaultContext.tsx` | modified | Routes through SyncManager; unchanged public API + `syncStatus`, `lastSyncAt` | +80 |
| `src/types/index.ts` | modified | +`VaultManifest`, `SyncStatus`, `DriveTags` | +60 |
| `src/constants/upload.ts` | modified | +`HISTORY_MAX_VERSIONS = 3`, +`MANIFEST_DEBOUNCE_MS = 800` | +5 |

**Zero UI files changed.** Screens (`home.tsx`, `docs.tsx`, `document/[id].tsx`, `upload/*`, `profile.tsx`) do not need edits for the MVP — they continue reading `VaultContext` as they do today. A tiny sync indicator can later be exposed inside the existing Google Drive card on Home *only if you want it visible*.

**No new dependencies required.** All operations use `fetch`/`XMLHttpRequest`, `expo-file-system`, `crypto-js`, `AsyncStorage`, and the already-linked Drive API endpoints.

---

## Open Questions for Approval

1. **`HISTORY_MAX_VERSIONS = 3`** — comfortable, or would you prefer 5 / 1 / configurable per doc?
2. **Two-phase delete GC window** — 24h reasonable, or should we surface an "Undo delete" UI now?
3. **Sync visibility** — keep it fully invisible for MVP, or add a compact chip on the Home Drive card showing "Last synced 2m ago"?
4. **Web platform** — treat as read-only preview only (upload paths remain mobile-only), or make the local-fallback path fully web-safe?
5. **Order of implementation** — proposed sequence for the build phase:
   1. Types + constants + `deviceId` bootstrapping (foundation)
   2. `FolderManager`
   3. `MetadataManager` (load/save/merge, no sync yet)
   4. `DriveService` extensions (download/find/update/resumable)
   5. `SyncManager` (bootstrap → pull → push → op-log → reconnect)
   6. `VaultContext` wiring (addDoc / updateDoc / deleteDoc routes)
   7. Multi-device conflict tests
   8. Error-recovery tests

Please review, mark any items you want to change, and confirm the implementation order. I'll wait for approval before writing a single line of code.
