import { createHash, createHmac } from "node:crypto";

/**
 * Minimal AWS Signature V4 for S3-compatible object storage (§11) — dependency-
 * free so the S3 driver needs no SDK. Supports signed requests (Authorization
 * header) and presigned GET URLs (query-string signing) against AWS S3, Cloudflare
 * R2, MinIO and any SigV4-compatible endpoint. Pure functions ⇒ unit-testable.
 */

export interface S3Creds {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

const sha256Hex = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

/** RFC3986 encoding; when `encodeSlash` is false, '/' is preserved (for object keys). */
export function uriEncode(str: string, encodeSlash = true): string {
  let out = "";
  for (const ch of Buffer.from(str, "utf8").toString("binary")) {
    if (/[A-Za-z0-9_.~-]/.test(ch)) out += ch;
    else if (ch === "/") out += encodeSlash ? "%2F" : "/";
    else out += "%" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
  }
  return out;
}

function amzDate(now: Date): { amz: string; date: string } {
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz, date: amz.slice(0, 8) };
}

function signingKey(secret: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac("AWS4" + secret, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/**
 * Produce a presigned URL (query-string auth). Default GET. `expiresIn` seconds.
 * `host` is the request host; `canonicalUri` the RFC3986-encoded path (key not
 * slash-encoded). Returns the fully-signed URL string.
 */
export function presignUrl(opts: {
  method?: string; protocol?: string; host: string; canonicalUri: string;
  creds: S3Creds; expiresIn: number; now?: Date; service?: string;
}): string {
  const { method = "GET", protocol = "https", host, canonicalUri, creds, expiresIn, service = "s3" } = opts;
  const now = opts.now ?? new Date();
  const { amz, date } = amzDate(now);
  const scope = `${date}/${creds.region}/${service}/aws4_request`;

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${creds.accessKeyId}/${scope}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(query).sort().map((k) => `${uriEncode(k)}=${uriEncode(query[k])}`).join("&");
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amz, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = hmac(signingKey(creds.secretAccessKey, date, creds.region, service), stringToSign).toString("hex");
  return `${protocol}://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Sign a request with an Authorization header. Returns headers to send. */
export function signRequest(opts: {
  method: string; host: string; canonicalUri: string; payload: Buffer | string;
  creds: S3Creds; now?: Date; service?: string; contentType?: string;
}): Record<string, string> {
  const { method, host, canonicalUri, payload, creds, service = "s3", contentType } = opts;
  const now = opts.now ?? new Date();
  const { amz, date } = amzDate(now);
  const scope = `${date}/${creds.region}/${service}/aws4_request`;
  const payloadHash = sha256Hex(typeof payload === "string" ? Buffer.from(payload) : payload);

  const headers: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amz };
  if (contentType) headers["content-type"] = contentType;
  const signedHeaderNames = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[Object.keys(headers).find((k) => k.toLowerCase() === h)!]}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amz, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = hmac(signingKey(creds.secretAccessKey, date, creds.region, service), stringToSign).toString("hex");
  headers["authorization"] = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return headers;
}
