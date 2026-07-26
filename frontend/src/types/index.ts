export type DocCategory =
  | 'Insurance'
  | 'ID'
  | 'Health'
  | 'Finance'
  | 'Education'
  | 'Property'
  | 'Vehicle'
  | 'Other';

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  avatar?: string;
  dob?: string; // ISO
}

export interface DocReminder {
  days30: boolean;
  days7: boolean;
  days1: boolean;
}

export type SyncState = 'pending-upload' | 'uploading' | 'synced' | 'failed' | 'deleted';

export interface VaultDocument {
  id: string;
  name: string;
  category: DocCategory;
  ownerId: string; // 'me' or family id
  fileId: string | null; // Google Drive file ID (null in demo)
  localUri?: string | null; // encrypted file local path (fallback)
  mimeType?: string;
  size?: number;
  /** SHA-256 hex digest of the raw (pre-encryption) file bytes. Used for duplicate detection. */
  fileHash?: string;
  encrypted: true;
  /** Current sync state — driven by UploadCoordinator (Sprint 3). Defaults to 'synced'. */
  syncState?: SyncState;
  /** Last upload error message, if syncState === 'failed'. */
  syncError?: string | null;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
  reminder: DocReminder;
  createdAt: string;
  updatedAt: string;
}

export interface VaultEvent {
  id: string;
  title: string;
  type: 'appointment' | 'birthday' | 'custom';
  date: string;
  ownerId?: string;
  notes?: string;
  reminder: DocReminder;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  accessToken?: string;
  refreshToken?: string;
  demo: boolean;
}

export interface DriveUsage {
  total: number;
  used: number;
  vault: number;
}
