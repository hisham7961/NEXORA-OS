import { describe, it, expect } from "vitest";
import { presignUrl, signRequest, uriEncode } from "@/lib/storage/sigv4";

/**
 * §11 S3 SigV4 signer. Deterministic, self-contained checks: encoding rules,
 * presigned-URL structure/stability, and signed-request header shape. (Full AWS
 * conformance is exercised against a real endpoint in staging; these lock the
 * signing contract in CI without network.)
 */
const creds = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", region: "us-east-1" };
const now = new Date("2026-03-10T12:00:00Z");

describe("uriEncode", () => {
  it("encodes reserved chars and preserves unreserved", () => {
    expect(uriEncode("a b+c")).toBe("a%20b%2Bc");
    expect(uriEncode("A-Z_a.z~9")).toBe("A-Z_a.z~9");
  });
  it("encodes slash by default, preserves it when asked", () => {
    expect(uriEncode("a/b")).toBe("a%2Fb");
    expect(uriEncode("a/b", false)).toBe("a/b");
  });
});

describe("presignUrl", () => {
  const url = presignUrl({ host: "bucket.s3.us-east-1.amazonaws.com", canonicalUri: "/files/2026/03/abc.pdf", creds, expiresIn: 300, now });
  it("includes all SigV4 query params and a signature", () => {
    expect(url).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    expect(url).toContain("X-Amz-Credential=AKIDEXAMPLE%2F20260310%2Fus-east-1%2Fs3%2Faws4_request");
    expect(url).toContain("X-Amz-Date=20260310T120000Z");
    expect(url).toContain("X-Amz-Expires=300");
    expect(url).toContain("X-Amz-SignedHeaders=host");
    expect(url).toMatch(/X-Amz-Signature=[0-9a-f]{64}$/);
  });
  it("is deterministic for the same inputs", () => {
    const again = presignUrl({ host: "bucket.s3.us-east-1.amazonaws.com", canonicalUri: "/files/2026/03/abc.pdf", creds, expiresIn: 300, now });
    expect(again).toBe(url);
  });
  it("changes the signature when the key changes", () => {
    const other = presignUrl({ host: "bucket.s3.us-east-1.amazonaws.com", canonicalUri: "/files/2026/03/xyz.pdf", creds, expiresIn: 300, now });
    expect(other).not.toBe(url);
  });
});

describe("signRequest", () => {
  it("produces an Authorization header with credential scope + signed headers", () => {
    const headers = signRequest({ method: "PUT", host: "bucket.s3.us-east-1.amazonaws.com", canonicalUri: "/files/x.bin", payload: Buffer.from("hello"), creds, now, contentType: "application/octet-stream" });
    expect(headers.authorization).toContain("AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260310/us-east-1/s3/aws4_request");
    expect(headers.authorization).toMatch(/Signature=[0-9a-f]{64}/);
    expect(headers["x-amz-date"]).toBe("20260310T120000Z");
    // payload hash present + signed
    expect(headers["x-amz-content-sha256"]).toMatch(/^[0-9a-f]{64}$/);
    expect(headers.authorization).toContain("SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date");
  });
});
