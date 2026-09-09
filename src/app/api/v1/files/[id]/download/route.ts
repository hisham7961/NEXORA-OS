import { route } from "@/lib/api/handler";
import { downloadFile } from "@/domain/files";

/**
 * GET /api/v1/files/:id/download?version=&disposition=inline|attachment
 * Authorized streaming — restricted files are never public URLs and are audited.
 */
export const GET = route<{ id: string }>(async ({ principal, params, req }) => {
  const url = new URL(req.url);
  const versionId = url.searchParams.get("version") ?? undefined;
  const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
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
