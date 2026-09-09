import { route } from "@/lib/api/handler";
import { downloadFile, signedDownloadUrl } from "@/domain/files";

/**
 * GET /api/v1/files/:id/download?version=&disposition=inline|attachment&redirect=1
 * Authorized access — restricted files are never public URLs and are audited.
 * With redirect=1, and when the storage driver supports signed URLs (S3/R2), the
 * response is a 302 to a short-lived presigned URL instead of streaming bytes.
 */
export const GET = route<{ id: string }>(async ({ principal, params, req }) => {
  const url = new URL(req.url);
  const versionId = url.searchParams.get("version") ?? undefined;
  const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";

  if (url.searchParams.get("redirect") === "1") {
    const signed = await signedDownloadUrl(principal, params.id, versionId);
    if (signed) return Response.redirect(signed, 302);
    // fall through to streaming when the driver has no signed URLs (local dev)
  }

  const result = await downloadFile(principal, params.id, versionId);
  const filename = result.name.replace(/"/g, "");
  return new Response(new Uint8Array(result.body), {
    status: 200,
    headers: {
      "Content-Type": result.mimeType,
      "Content-Length": String(result.sizeBytes),
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
