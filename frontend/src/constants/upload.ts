/**
 * Upload / storage configuration.
 *
 * Kept in a single module so tuning (or exposing to settings in the future) is trivial
 * and does not require touching multiple screens/services.
 */

/** Maximum size for a single-shot upload, in megabytes. */
export const MAX_UPLOAD_SIZE_MB = 50;

/** Same limit expressed in bytes — cheap to reuse where a byte comparison is needed. */
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

/**
 * Files larger than this threshold should eventually take the resumable-upload path.
 * Google Drive documents this at ~5 MB. Wired up for a future resumable engine —
 * unused today; declared here so callers can start reading from a stable name.
 */
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 5 * 1024 * 1024;
