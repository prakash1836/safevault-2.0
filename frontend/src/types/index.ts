// Core shared types

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  user: GoogleUser;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  appProperties?: Record<string, string>;
}

export interface VaultEntry {
  driveFileId: string;
  name: string;              // original filename (without .zip)
  zipName: string;           // filename.zip in drive
  originalMimeType?: string;
  sizeBytes?: number;
  uploadedAt: string;        // ISO
}
