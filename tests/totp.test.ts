import { describe, it, expect } from "vitest";
import { base32Encode, base32Decode, hotp, totp, verifyTotp, generateTotpSecret, otpauthUri } from "@/lib/auth/totp";

// RFC 4226 Appendix D — HOTP with ASCII secret "12345678901234567890".
const RFC_SECRET_ASCII = "12345678901234567890";
const RFC_SECRET_B32 = base32Encode(Buffer.from(RFC_SECRET_ASCII, "ascii"));

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    const b = Buffer.from([0, 1, 2, 253, 254, 255, 42, 17]);
    expect(base32Decode(base32Encode(b)).equals(b)).toBe(true);
  });
  it("encodes the RFC ASCII secret to the known base32", () => {
    expect(RFC_SECRET_B32).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });
  it("ignores spaces and case on decode", () => {
    expect(base32Decode("gezd gnbv").equals(base32Decode("GEZDGNBV"))).toBe(true);
  });
});

describe("HOTP (RFC 4226 Appendix D vectors)", () => {
  const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  it("matches all 10 counter vectors", () => {
    const secret = Buffer.from(RFC_SECRET_ASCII, "ascii");
    for (let c = 0; c < expected.length; c++) expect(hotp(secret, c, 6)).toBe(expected[c]);
  });
});

describe("TOTP (RFC 6238 Appendix B vectors, SHA1, 8 digits)", () => {
  // time (unix seconds) -> 8-digit code
  const vectors: [number, string][] = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  it("matches the canonical 8-digit codes", () => {
    for (const [time, code] of vectors) expect(totp(RFC_SECRET_B32, { time, digits: 8 })).toBe(code);
  });
  it("derives the 6-digit code as the last 6 digits", () => {
    expect(totp(RFC_SECRET_B32, { time: 59, digits: 6 })).toBe("287082");
  });
});

describe("verifyTotp", () => {
  it("accepts the current code", () => {
    const t = 1111111111;
    const code = totp(RFC_SECRET_B32, { time: t });
    expect(verifyTotp(RFC_SECRET_B32, code, { time: t })).toBe(true);
  });
  it("tolerates +/- one step of drift", () => {
    const t = 1111111111;
    const prev = totp(RFC_SECRET_B32, { time: t - 30 });
    const next = totp(RFC_SECRET_B32, { time: t + 30 });
    expect(verifyTotp(RFC_SECRET_B32, prev, { time: t, window: 1 })).toBe(true);
    expect(verifyTotp(RFC_SECRET_B32, next, { time: t, window: 1 })).toBe(true);
  });
  it("rejects a code two steps away with window 1", () => {
    const t = 1111111111;
    const far = totp(RFC_SECRET_B32, { time: t - 60 });
    expect(verifyTotp(RFC_SECRET_B32, far, { time: t, window: 1 })).toBe(false);
  });
  it("rejects wrong and malformed codes", () => {
    const t = 1111111111;
    expect(verifyTotp(RFC_SECRET_B32, "000000", { time: t })).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, "abc", { time: t })).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, "", { time: t })).toBe(false);
  });
  it("accepts a code entered with a space", () => {
    const t = 1111111111;
    const code = totp(RFC_SECRET_B32, { time: t });
    expect(verifyTotp(RFC_SECRET_B32, `${code.slice(0, 3)} ${code.slice(3)}`, { time: t })).toBe(true);
  });
});

describe("secret + otpauth", () => {
  it("generates a decodable 160-bit secret", () => {
    const s = generateTotpSecret();
    expect(base32Decode(s).length).toBe(20);
  });
  it("builds a scannable otpauth URI", () => {
    const uri = otpauthUri("JBSWY3DPEHPK3PXP", { issuer: "NEXORA OS", account: "user@example.com" });
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=NEXORA+OS");
    expect(uri).toContain("algorithm=SHA1");
  });
});
