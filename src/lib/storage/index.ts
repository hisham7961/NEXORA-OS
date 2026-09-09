import { randomBytes } from "node:crypto";
import type { StorageDriver } from "./types";
import { LocalStorageDriver } from "./local";
import { S3StorageDriver } from "./s3";

export type { StorageDriver, PutResult, StoredObject } from "./types";

let cached: StorageDriver | null = null;

/**
 * Resolve the configured storage driver. `NEXORA_STORAGE_DRIVER` selects the
 * implementation (default `local`); an `s3` driver is a drop-in that implements
 * the same interface. Business logic calls this — it never imports a concrete
 * driver — so the provider is a deployment concern only (§3).
 */
export function getStorage(): StorageDriver {
  if (cached) return cached;
  const driver = (process.env.NEXORA_STORAGE_DRIVER ?? "local").toLowerCase();
  switch (driver) {
    case "local":
      cached = new LocalStorageDriver();
      break;
    case "s3":
      cached = new S3StorageDriver();
      break;
    default:
      throw new Error(`Unknown NEXORA_STORAGE_DRIVER: ${driver}`);
  }
  return cached;
}

/**
 * Generate an opaque, collision-resistant storage key. Never derived from a
 * user-supplied filename, so uploads cannot influence the storage path. Shape:
 * `files/<yyyy>/<mm>/<random>[.ext]` — the optional extension is sanitized to a
 * short alphanumeric token purely for human/debug convenience.
 */
export function newStorageKey(originalName?: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const rand = randomBytes(16).toString("hex");
  const extMatch = originalName?.match(/\.([A-Za-z0-9]{1,8})$/);
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : "";
  return `files/${yyyy}/${mm}/${rand}${ext}`;
}
