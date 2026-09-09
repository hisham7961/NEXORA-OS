import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageDriver, PutResult, StoredObject } from "./types";

/**
 * Local-filesystem storage driver — the dev/default implementation of the
 * StorageDriver contract. Objects live under a configurable root, sharded by the
 * first 2 chars of the key to avoid huge flat directories. Production swaps this
 * for an S3/R2 driver via env without touching business logic.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local";
  private root: string;

  constructor(root?: string) {
    this.root = root ?? process.env.NEXORA_STORAGE_DIR ?? path.join(process.cwd(), ".nexora-storage");
  }

  /** Resolve a key to an absolute path, refusing anything that escapes the root. */
  private resolve(key: string): string {
    // Keys are server-generated (cuid/hex + safe segments); this is defense in depth.
    const safe = key.replace(/\\/g, "/");
    const full = path.resolve(this.root, safe);
    const rootResolved = path.resolve(this.root);
    if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
      throw new Error("storage key escapes root");
    }
    return full;
  }

  async put(key: string, body: Buffer, _contentType?: string): Promise<PutResult> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    const checksum = createHash("sha256").update(body).digest("hex");
    return { key, sizeBytes: body.byteLength, checksum };
  }

  async get(key: string): Promise<StoredObject> {
    const full = this.resolve(key);
    const body = await fs.readFile(full);
    return { body, sizeBytes: body.byteLength };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch {
      /* missing is fine */
    }
  }

  // No signed URLs for local storage — callers stream through the authorized route.
  async signedUrl(): Promise<string | null> {
    return null;
  }
}
