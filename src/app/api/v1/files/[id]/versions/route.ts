import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { addFileVersion } from "@/domain/files";

/** POST /api/v1/files/:id/versions — multipart new version (append-only). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params, req }) => {
  const form = await req.formData().catch(() => { throw new ServiceError("bad_request", "multipart/form-data required", 400); });
  const blob = form.get("file");
  if (!blob || typeof blob === "string") throw new ServiceError("no_file", "A `file` part is required", 400);
  const buf = Buffer.from(await (blob as unknown as File).arrayBuffer());
  const note = form.get("note");
  const v = await addFileVersion({ principal, ip, userAgent }, params.id, {
    filename: (blob as unknown as File).name, body: buf, mimeType: (blob as unknown as File).type || "application/octet-stream",
    note: typeof note === "string" ? note : undefined,
  });
  return ok(v);
});
