import { describe, it, expect } from "vitest";
import { validateUpload, inferCategory, MAX_FILE_BYTES } from "@/lib/storage/validation";

/** Phase 2.5 §4 — upload validation is the server-side security boundary. */
describe("upload validation", () => {
  it("accepts a normal PDF", () => {
    expect(validateUpload({ filename: "spec.pdf", mimeType: "application/pdf", sizeBytes: 1024 })).toBeNull();
  });
  it("rejects dangerous extensions regardless of mime", () => {
    expect(validateUpload({ filename: "run.exe", mimeType: "application/octet-stream", sizeBytes: 10 })?.code).toBe("blocked_ext");
    expect(validateUpload({ filename: "a.js", mimeType: "text/plain", sizeBytes: 10 })?.code).toBe("blocked_ext");
    expect(validateUpload({ filename: "page.html", mimeType: "text/html", sizeBytes: 10 })?.code).toBe("blocked_ext");
  });
  it("rejects unsupported extensions", () => {
    expect(validateUpload({ filename: "a.xyz", mimeType: "application/octet-stream", sizeBytes: 10 })?.code).toBe("ext_not_allowed");
  });
  it("rejects a mime that disagrees with the extension", () => {
    expect(validateUpload({ filename: "a.png", mimeType: "application/pdf", sizeBytes: 10 })?.code).toBe("mime_mismatch");
  });
  it("accepts an octet-stream fallback mime", () => {
    expect(validateUpload({ filename: "a.png", mimeType: "application/octet-stream", sizeBytes: 10 })).toBeNull();
  });
  it("rejects path separators and traversal in the filename", () => {
    expect(validateUpload({ filename: "../etc/passwd.pdf", mimeType: "application/pdf", sizeBytes: 10 })?.code).toBe("bad_name");
    expect(validateUpload({ filename: "a/b.pdf", mimeType: "application/pdf", sizeBytes: 10 })?.code).toBe("bad_name");
  });
  it("rejects empty and oversized files", () => {
    expect(validateUpload({ filename: "a.pdf", mimeType: "application/pdf", sizeBytes: 0 })?.code).toBe("empty");
    expect(validateUpload({ filename: "a.pdf", mimeType: "application/pdf", sizeBytes: MAX_FILE_BYTES + 1 })?.code).toBe("too_large");
  });
  it("rejects a missing extension", () => {
    expect(validateUpload({ filename: "README", mimeType: "text/plain", sizeBytes: 10 })?.code).toBe("no_ext");
  });
  it("infers category from mime", () => {
    expect(inferCategory("image/png")).toBe("image");
    expect(inferCategory("video/mp4")).toBe("video");
    expect(inferCategory("application/pdf")).toBe("document");
    expect(inferCategory("text/csv")).toBe("spreadsheet");
  });
});
