import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listRegistrations, registrationQuerySchema } from "@/domain/registrations";

/** GET /api/v1/registrations */
export const GET = route(async ({ principal, req }) => {
  const query = registrationQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listRegistrations(principal, query);
  return ok(rows, pageMeta(total, query));
});
