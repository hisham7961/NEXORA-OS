import { createHash } from "node:crypto";
import type { StorageDriver, PutResult, StoredObject } from "./types";
import { presignUrl, signRequest, uriEncode, type S3Creds } from "./sigv4";

/**
 * S3-compatible storage driver (§11) — the production implementation of the
 * StorageDriver contract. Talks to AWS S3, Cloudflare R2, MinIO or any
 * SigV4-compatible endpoint using dependency-free signing (no AWS SDK). Restricted
 * files are served via short-lived presigned GET URLs (signedUrl), never a
 * permanent public URL. Selected with NEXORA_STORAGE_DRIVER=s3.
 *
 * Env: NEXORA_S3_BUCKET, NEXORA_S3_REGION, NEXORA_S3_ACCESS_KEY_ID,
 * NEXORA_S3_SECRET_ACCESS_KEY, optional NEXORA_S3_ENDPOINT (for R2/MinIO) and
 * NEXORA_S3_FORCE_PATH_STYLE=1.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = "s3";
  private bucket: string;
  private creds: S3Creds;
  private endpoint: string;
  private pathStyle: boolean;
  private protocol: string;

  constructor() {
    const bucket = process.env.NEXORA_S3_BUCKET;
    const accessKeyId = process.env.NEXORA_S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.NEXORA_S3_SECRET_ACCESS_KEY;
    const region = process.env.NEXORA_S3_REGION ?? "us-east-1";
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error("S3 storage requires NEXORA_S3_BUCKET, NEXORA_S3_ACCESS_KEY_ID and NEXORA_S3_SECRET_ACCESS_KEY");
    }
    this.bucket = bucket;
    this.creds = { accessKeyId, secretAccessKey, region };
    // Endpoint host (no scheme). Default AWS S3 regional endpoint.
    const rawEndpoint = process.env.NEXORA_S3_ENDPOINT ?? `s3.${region}.amazonaws.com`;
    this.protocol = rawEndpoint.startsWith("http://") ? "http" : "https";
    this.endpoint = rawEndpoint.replace(/^https?:\/\//, "").replace(/\/$/, "");
    this.pathStyle = process.env.NEXORA_S3_FORCE_PATH_STYLE === "1" || !!process.env.NEXORA_S3_ENDPOINT;
  }

  /** { host, canonicalUri } for a given object key. */
  private target(key: string): { host: string; canonicalUri: string } {
    const encodedKey = "/" + key.split("/").map((seg) => uriEncode(seg)).join("/");
    if (this.pathStyle) return { host: this.endpoint, canonicalUri: `/${this.bucket}${encodedKey}` };
    return { host: `${this.bucket}.${this.endpoint}`, canonicalUri: encodedKey };
  }

  async put(key: string, body: Buffer, contentType?: string): Promise<PutResult> {
    const { host, canonicalUri } = this.target(key);
    const headers = signRequest({ method: "PUT", host, canonicalUri, payload: body, creds: this.creds, contentType });
    const res = await fetch(`${this.protocol}://${host}${canonicalUri}`, { method: "PUT", headers, body: new Uint8Array(body) });
    if (!res.ok) throw new Error(`S3 put failed: ${res.status} ${await res.text().catch(() => "")}`);
    const checksum = createHash("sha256").update(body).digest("hex");
    return { key, sizeBytes: body.byteLength, checksum };
  }

  async get(key: string): Promise<StoredObject> {
    const { host, canonicalUri } = this.target(key);
    const headers = signRequest({ method: "GET", host, canonicalUri, payload: "", creds: this.creds });
    const res = await fetch(`${this.protocol}://${host}${canonicalUri}`, { method: "GET", headers });
    if (!res.ok) throw new Error(`S3 get failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return { body: buf, sizeBytes: buf.byteLength, contentType: res.headers.get("content-type") ?? undefined };
  }

  async exists(key: string): Promise<boolean> {
    const { host, canonicalUri } = this.target(key);
    const headers = signRequest({ method: "HEAD", host, canonicalUri, payload: "", creds: this.creds });
    const res = await fetch(`${this.protocol}://${host}${canonicalUri}`, { method: "HEAD", headers });
    return res.ok;
  }

  async remove(key: string): Promise<void> {
    const { host, canonicalUri } = this.target(key);
    const headers = signRequest({ method: "DELETE", host, canonicalUri, payload: "", creds: this.creds });
    await fetch(`${this.protocol}://${host}${canonicalUri}`, { method: "DELETE", headers }).catch(() => {});
  }

  /** Short-lived presigned GET URL — the secure way to serve a restricted file. */
  async signedUrl(key: string, expiresInSeconds: number): Promise<string | null> {
    const { host, canonicalUri } = this.target(key);
    return presignUrl({ protocol: this.protocol, host, canonicalUri, creds: this.creds, expiresIn: Math.min(Math.max(expiresInSeconds, 1), 604800) });
  }
}
