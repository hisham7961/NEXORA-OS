import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Authenticated symmetric encryption (AES-256-GCM) for small secrets stored at rest
 * — currently MFA/TOTP secrets (§27). The key is derived from the session secret, so
 * a database leak alone never yields a usable secret. Rotating NEXORA_SESSION_SECRET
 * invalidates sealed values (users fall back to recovery codes), which is acceptable.
 */
const KEY = scryptSync(env.sessionSecret, "nexora-secretbox-v1", 32);

/** Encrypt a UTF-8 string to `v1.<iv>.<tag>.<ciphertext>` (all base64url). */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

/** Decrypt a value produced by seal(); returns null on any tampering or format error. */
export function open(sealed: string | null): string | null {
  if (!sealed) return null;
  try {
    const [v, ivB, tagB, ctB] = sealed.split(".");
    if (v !== "v1" || !ivB || !tagB || !ctB) return null;
    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
