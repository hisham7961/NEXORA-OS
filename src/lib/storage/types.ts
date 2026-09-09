/**
 * Storage abstraction (Phase 2.5 §3). Business logic depends ONLY on this
 * interface — never on a concrete provider — so the local-filesystem driver used
 * in dev can be swapped for S3/R2/GCS in production by configuration alone.
 *
 * Keys are opaque, server-generated strings (never derived from a user-supplied
 * filename), which is also our first line of defense against path traversal.
 */
export interface PutResult {
  key: string;
  sizeBytes: number;
  checksum: string; // sha256 hex
}

export interface StoredObject {
  body: Buffer;
  sizeBytes: number;
  contentType?: string;
}

export interface StorageDriver {
  readonly name: string;
  /** Persist bytes under `key`. Returns size + sha256 checksum. */
  put(key: string, body: Buffer, contentType?: string): Promise<PutResult>;
  /** Fetch the object bytes. Throws if missing. */
  get(key: string): Promise<StoredObject>;
  /** Whether the object exists. */
  exists(key: string): Promise<boolean>;
  /** Remove the object (best-effort; missing is not an error). */
  remove(key: string): Promise<void>;
  /**
   * A time-limited authorized URL, when the driver supports it (e.g. S3 signed
   * URLs). The local driver returns null, and callers fall back to streaming the
   * bytes through the authorized download route. Restricted files must never be
   * served from a permanent public URL.
   */
  signedUrl?(key: string, expiresInSeconds: number): Promise<string | null>;
}
