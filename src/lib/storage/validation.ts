/**
 * Upload validation (Phase 2.5 §4). Enforced server-side on every upload and new
 * version. We validate size, MIME, extension and category, and reject anything
 * whose extension/MIME disagree or that carries a dangerous extension.
 */

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file/version

export const FILE_CATEGORIES = [
  "document", "image", "video", "creative", "regulatory", "contract", "spreadsheet", "other",
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

/** Allowed extension → canonical MIME(s). The allowlist is the security boundary. */
const ALLOWED: Record<string, string[]> = {
  // documents
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  txt: ["text/plain"],
  md: ["text/markdown", "text/plain"],
  rtf: ["application/rtf", "text/rtf"],
  // spreadsheets
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  csv: ["text/csv", "text/plain"],
  // presentations
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  // images
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  svg: ["image/svg+xml"],
  heic: ["image/heic"],
  // video / audio
  mp4: ["video/mp4"],
  mov: ["video/quicktime"],
  webm: ["video/webm"],
  mp3: ["audio/mpeg"],
  // design / archives
  psd: ["image/vnd.adobe.photoshop", "application/octet-stream"],
  ai: ["application/postscript", "application/pdf", "application/octet-stream"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

/** Extensions we never accept regardless of MIME. */
const BLOCKED_EXT = new Set([
  "exe", "bat", "cmd", "com", "sh", "bash", "ps1", "msi", "scr", "js", "mjs", "cjs",
  "jar", "app", "dmg", "deb", "rpm", "php", "phtml", "pl", "py", "rb", "html", "htm", "svgz",
]);

export interface UploadValidationInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  category?: string;
}

export interface UploadValidationError {
  code: string;
  message: string;
}

function extOf(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return m ? m[1] : "";
}

/** Returns an error object if the upload is rejected, or null when it passes. */
export function validateUpload(input: UploadValidationInput): UploadValidationError | null {
  const name = (input.filename ?? "").trim();
  if (!name) return { code: "no_name", message: "A filename is required." };
  // Path-traversal / separators in the display name are rejected outright.
  if (/[\\/]/.test(name) || name.includes("..")) {
    return { code: "bad_name", message: "Filename must not contain path separators." };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { code: "empty", message: "The file is empty." };
  }
  if (input.sizeBytes > MAX_FILE_BYTES) {
    return { code: "too_large", message: `File exceeds the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB limit.` };
  }
  const ext = extOf(name);
  if (!ext) return { code: "no_ext", message: "The file must have an extension." };
  if (BLOCKED_EXT.has(ext)) return { code: "blocked_ext", message: `The .${ext} type is not allowed.` };
  const allowedMimes = ALLOWED[ext];
  if (!allowedMimes) return { code: "ext_not_allowed", message: `The .${ext} type is not supported.` };
  const mime = (input.mimeType || "").toLowerCase().split(";")[0].trim();
  // Some browsers send an empty or generic MIME — accept the octet-stream fallback,
  // but reject a MIME that clearly disagrees with the extension.
  if (mime && mime !== "application/octet-stream" && !allowedMimes.includes(mime)) {
    return { code: "mime_mismatch", message: `The content type (${mime}) does not match .${ext}.` };
  }
  if (input.category && !(FILE_CATEGORIES as readonly string[]).includes(input.category)) {
    return { code: "bad_category", message: "Unknown file category." };
  }
  return null;
}

/** Best-effort category inference from MIME, used when the caller doesn't specify. */
export function inferCategory(mimeType: string): FileCategory {
  const m = (mimeType || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.includes("spreadsheet") || m === "text/csv" || m.includes("ms-excel")) return "spreadsheet";
  if (m === "application/pdf" || m.includes("word") || m === "text/plain" || m.includes("presentation")) return "document";
  return "other";
}
