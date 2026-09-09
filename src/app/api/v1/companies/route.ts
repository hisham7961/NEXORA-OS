import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listCompanies, companyQuerySchema } from "@/domain/companies";
import { createCompany } from "@/domain/org-admin";

export const GET = route(async ({ principal, req }) => {
  const query = companyQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listCompanies(principal, query);
  return ok(rows, pageMeta(total, query));
});
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await createCompany({ principal, ip, userAgent }, body));
});
