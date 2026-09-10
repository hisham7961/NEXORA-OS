import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Dependency-free TOTP (RFC 6238) + HOTP (RFC 4226) with RFC 4648 base32, using
 * the Node crypto builtin only. Compatible with Google Authenticator / Authy /
 * 1Password (HMAC-SHA1, 6 digits, 30s step). Used for MFA (§26-27). No external
 * library is added — the algorithm is small and standard.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue; // skip stray separators
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

/** HOTP: one code for a monotonic counter (RFC 4226 dynamic truncation). */
export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 10 ** digits).toString().padStart(digits, "0");
}

interface TotpOpts { time?: number; step?: number; digits?: number }

/** The current TOTP code for a base32 secret. */
export function totp(base32Secret: string, opts: TotpOpts = {}): string {
  const step = opts.step ?? 30;
  const digits = opts.digits ?? 6;
  const time = opts.time ?? Math.floor(Date.now() / 1000);
  return hotp(base32Decode(base32Secret), Math.floor(time / step), digits);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

/**
 * Verify a submitted code, tolerating +/- `window` steps of clock drift (default 1
 * = ±30s). Uses a constant-time compare so a wrong code leaks no timing signal.
 */
export function verifyTotp(base32Secret: string, code: string, opts: TotpOpts & { window?: number } = {}): boolean {
  const step = opts.step ?? 30;
  const digits = opts.digits ?? 6;
  const window = opts.window ?? 1;
  const time = opts.time ?? Math.floor(Date.now() / 1000);
  const secret = base32Decode(base32Secret);
  const counter = Math.floor(time / step);
  const clean = code.replace(/\s/g, "");
  if (!/^\d+$/.test(clean)) return false;
  for (let w = -window; w <= window; w++) {
    if (safeEqual(hotp(secret, counter + w, digits), clean)) return true;
  }
  return false;
}

/** A fresh random base32 secret (160 bits — the RFC-recommended SHA1 key size). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

/** otpauth:// URI for QR enrollment in an authenticator app. */
export function otpauthUri(base32Secret: string, { issuer, account }: { issuer: string; account: string }): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: base32Secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
