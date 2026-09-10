import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { dimensionPnl, type PnlDimension } from "@/domain/accounting/intelligence";

const DIMS = ["brand", "country", "product", "store", "campaign", "department"];

export const GET = route(async ({ principal, req }) => {
  const u = new URL(req.url); const companyId = u.searchParams.get("companyId");
  if (!companyId) throw new ServiceError("missing_company", "companyId is required", 400);
  const dimension = (u.searchParams.get("dimension") ?? "brand") as PnlDimension;
  if (!DIMS.includes(dimension)) throw new ServiceError("bad_dimension", `dimension must be one of ${DIMS.join(", ")}`, 400);
  const from = u.searchParams.get("from"); const to = u.searchParams.get("to");
  return ok(await dimensionPnl(principal, companyId, dimension, { from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined }));
});
