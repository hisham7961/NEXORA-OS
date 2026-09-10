import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { previewImport } from "@/domain/importers";

export const POST = route<{ resource: string }>(async ({ principal, params, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  const { companyId, csvText, mapping } = body as { companyId?: string; csvText?: string; mapping?: unknown };
  if (!csvText) throw new ServiceError("missing", "csvText is required", 400);
  return ok(await previewImport(principal, params.resource, companyId ?? null, csvText, mapping));
});
