// ZIP encryption / decryption using @zip.js/zip.js (AES-256, WinZip AES).
// We import the native CJS entry to avoid `import.meta.url` which breaks in
// the Metro bundler (web & native). No web workers needed.

import {
  BlobReader,
  BlobWriter,
  ZipReader,
  ZipWriter,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  configure,
// @ts-ignore - subpath has no types; re-exports the same API
} from '@zip.js/zip.js/index-native.cjs';

// Never use web workers; crypto/deflate runs on the JS thread.
configure({ useWebWorkers: false });

export interface ZipFileInput {
  /** Name of the file inside the ZIP (usually the original filename). */
  name: string;
  /** File content. */
  data: Uint8Array | Blob;
  /** Optional mime type hint stored as a comment. */
  mimeType?: string;
}

export interface ZippedFile {
  name: string;
  data: Uint8Array;
  mimeType?: string;
  comment?: string;
}

export const zipService = {
  /**
   * Create a password-protected ZIP (AES-256) containing a single file.
   * Returns the zip bytes as a Blob.
   */
  async createEncryptedZip(
    input: ZipFileInput,
    password: string,
  ): Promise<Blob> {
    if (!password) throw new Error('Password is required to create encrypted ZIP.');

    const writer = new ZipWriter(new BlobWriter('application/zip'), {
      password,
      encryptionStrength: 3, // 3 = AES-256 (WinZip AES)
      zipCrypto: false,      // force AES-256, not legacy ZipCrypto
      level: 6,
    });

    const entryReader =
      input.data instanceof Uint8Array
        ? new Uint8ArrayReader(input.data)
        : new BlobReader(input.data);

    await writer.add(input.name, entryReader, {
      comment: input.mimeType ? `mime:${input.mimeType}` : undefined,
    });

    return writer.close();
  },

  /**
   * Extract the first file from a password-protected ZIP.
   * Throws if the password is wrong.
   */
  async extractEncryptedZip(
    zipData: Blob | Uint8Array,
    password: string,
  ): Promise<ZippedFile> {
    if (!password) throw new Error('Password is required to open encrypted ZIP.');

    const reader = new ZipReader(
      zipData instanceof Uint8Array
        ? new Uint8ArrayReader(zipData)
        : new BlobReader(zipData),
      { password },
    );

    try {
      const entries = await reader.getEntries();
      if (!entries.length) throw new Error('ZIP is empty.');
      const entry = entries[0];

      if (!('getData' in entry) || !entry.getData) throw new Error('Invalid ZIP entry.');

      const data = await entry.getData(new Uint8ArrayWriter(), { password });

      // Parse mime from comment if present
      let mimeType: string | undefined;
      if (entry.comment && entry.comment.startsWith('mime:')) {
        mimeType = entry.comment.substring('mime:'.length);
      }

      return {
        name: entry.filename,
        data,
        mimeType,
        comment: entry.comment,
      };
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('password') || msg.includes('invalid pass') || msg.includes('wrong password')) {
        throw new Error('Incorrect password.');
      }
      throw e;
    } finally {
      await reader.close();
    }
  },
};
