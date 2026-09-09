import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listFiles, uploadFile, fileQuerySchema } from "@/domain/files";

/** GET /api/v1/files — files in scope (restricted ones only for authorized callers). */
export const GET = route(async ({ principal, req }) => {
  const query = fileQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listFiles(principal, query);
  return ok(rows, pageMeta(total, query));
});

/** POST /api/v1/files — multipart upload (field `file`, plus metadata fields). */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const form = await req.formData().catch(() => { throw new ServiceError("bad_request", "multipart/form-data required", 400); });
  const blob = form.get("file");
  if (!blob || typeof blob === "string") throw new ServiceError("no_file", "A `file` part is required", 400);
  const buf = Buffer.from(await (blob as unknown as File).arrayBuffer());
  const tags = form.getAll("tags").map(String).filter(Boolean);
  const s = (k: string) => { const v = form.get(k); return typeof v === "string" && v.trim() ? v.trim() : undefined; };
  const file = await uploadFile({ principal, ip, userAgent }, {
    filename: (blob as unknown as File).name, body: buf, mimeType: (blob as unknown as File).type || "application/octet-stream",
    folderId: s("folderId"), category: s("category"), tags, description: s("description"),
    visibility: (s("visibility") as "internal" | "restricted") ?? "internal",
    companyId: s("companyId"), brandId: s("brandId"), countryId: s("countryId"),
    relatedType: s("relatedType"), relatedId: s("relatedId"),
  });
  return ok(file);
});
