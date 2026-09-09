/** Presentation helpers for the file platform (client-safe, no server imports). */

export function formatBytes(bytes?: number | null): string {
  if (bytes == null || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

/** Authorized download/preview URL (streamed through the API, permission-checked). */
export function fileDownloadHref(fileId: string, opts?: { versionId?: string; inline?: boolean }): string {
  const p = new URLSearchParams();
  if (opts?.versionId) p.set("version", opts.versionId);
  if (opts?.inline) p.set("disposition", "inline");
  const qs = p.toString();
  return `/api/v1/files/${fileId}/download${qs ? `?${qs}` : ""}`;
}

/** True when the browser can render an inline preview for this mime. */
export function isPreviewable(mime?: string | null): boolean {
  const m = (mime ?? "").toLowerCase();
  return m.startsWith("image/") || m === "application/pdf";
}

export const FILE_CATEGORY_LABELS: Record<string, string> = {
  document: "Document",
  image: "Image",
  video: "Video",
  creative: "Creative",
  regulatory: "Regulatory",
  contract: "Contract",
  spreadsheet: "Spreadsheet",
  other: "Other",
};
