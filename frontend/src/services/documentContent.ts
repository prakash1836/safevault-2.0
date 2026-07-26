// DocumentContent — Sprint 3 of Phase 2.
//
// Cache-first, integrity-verified content retrieval for a VaultDocument.
//
//    Local cache?
//        ↓ yes                    ↓ no
//    open immediately         Download from Google Drive
//                                 ↓
//                             Verify integrity (SHA-256)
//                                 ↓
//                             Cache locally
//                                 ↓
//                             open
//
// The function returns the DECRYPTED bytes as a Base64 string (matching the
// existing document/[id].tsx conventions). The caller is responsible for
// piping those bytes to a file / share sheet / preview.

import CryptoJS from 'crypto-js';
import type { AuthUser, VaultDocument } from '../types';
import {
  readEncryptedLocal,
  saveEncryptedLocal,
  downloadFromDrive,
} from './drive';
import { decryptToBase64, getKey } from './encryption';

/** SHA-256 hex of a base64-encoded payload (raw plaintext bytes). */
function sha256OfBase64(b64: string): string {
  const wa = CryptoJS.enc.Base64.parse(b64);
  return CryptoJS.SHA256(wa).toString(CryptoJS.enc.Hex);
}

export interface GetContentResult {
  /** Base64-encoded plaintext, ready to write to disk / share. */
  base64: string;
  /** How the content was obtained. */
  source: 'cache' | 'drive';
  /** true if we downloaded and cached the file during this call. */
  cachedNow: boolean;
  /** true if a stored fileHash was checked and matched. */
  integrityVerified: boolean;
  /** Set when the doc's fileHash was present but did not match — decryption still returned data. */
  integrityWarning?: string;
  /** localUri populated after we cached (only when cachedNow=true). */
  localUri?: string | null;
}

/**
 * Best-effort cache-first read.
 *
 * Never downloads the same file twice if the local cache is valid: after a
 * successful Drive download the ciphertext is written to disk (when the
 * platform supports it) and subsequent calls short-circuit.
 */
export async function getDocumentContent(
  user: AuthUser,
  doc: VaultDocument,
  opts: { onProgress?: (p: number) => void } = {}
): Promise<GetContentResult> {
  const key = await getKey();
  if (!key) throw new Error('Missing encryption key');

  // 1. Local cache
  if (doc.localUri) {
    const cipher = await readEncryptedLocal(doc.localUri);
    if (cipher) {
      const base64 = decryptToBase64(cipher, key);
      const check = verifyIntegrity(base64, doc.fileHash);
      return {
        base64,
        source: 'cache',
        cachedNow: false,
        integrityVerified: check.verified,
        integrityWarning: check.warning,
        localUri: doc.localUri,
      };
    }
  }

  // 2. Drive fetch
  if (!doc.fileId) throw new Error('No file on Drive for this document');
  const cipher = await downloadFromDrive(user, doc.fileId, { onProgress: opts.onProgress });
  const base64 = decryptToBase64(cipher, key);
  const check = verifyIntegrity(base64, doc.fileHash);

  // 3. Cache locally for next time (native only — no-op returns null on web)
  let localUri: string | null = doc.localUri ?? null;
  try {
    const cached = await saveEncryptedLocal(doc.id, cipher);
    if (cached) localUri = cached;
  } catch {
    // Cache write is best-effort; do not fail the read.
  }

  return {
    base64,
    source: 'drive',
    cachedNow: localUri !== (doc.localUri ?? null) && localUri !== null,
    integrityVerified: check.verified,
    integrityWarning: check.warning,
    localUri,
  };
}

function verifyIntegrity(base64: string, expected: string | undefined | null): {
  verified: boolean;
  warning?: string;
} {
  if (!expected) return { verified: false }; // legacy docs — nothing to check
  try {
    const actual = sha256OfBase64(base64);
    if (actual === expected) return { verified: true };
    return {
      verified: false,
      warning: `File integrity check did not match (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`,
    };
  } catch {
    return { verified: false, warning: 'Could not compute file hash for integrity check' };
  }
}
