// Centralized constants

export const APP_FOLDER_NAME = 'SafeVault';
export const VAULT_INDEX_FILENAME = 'vault_index.json';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
];

export const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

// File marker in Drive appProperties so we only list files from THIS app
export const APP_MARKER_KEY = 'safevault';
export const APP_MARKER_VALUE = 'v1';

// Password hashing / verification
export const PBKDF2_ITERATIONS = 150_000;
export const PBKDF2_KEY_LEN = 32; // bytes

export const STORAGE_KEYS = {
  authSession: 'safevault.auth.session',
  passwordVerifier: 'safevault.password.verifier', // { salt, hash, iterations }
  cachedIndex: 'safevault.index.cache',
} as const;
