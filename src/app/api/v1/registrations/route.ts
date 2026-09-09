import { route, ServiceError } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listRegistrations, createRegistrationCase, registrationQuerySchema } from "@/domain/registrations";

/** GET /api/v1/registrations — scoped list. */
export const GET = route(async ({ principal, req }) => {
  const query = registrationQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listRegistrations(principal, query);
  return ok(rows, pageMeta(total, query));
});

/** POST /api/v1/registrations — open a registration case within scope. */
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => {
    throw new ServiceError("invalid_json", "Request body must be valid JSON", 400);
  });
  const r = await createRegistrationCase({ principal, ip, userAgent }, body);
  return created({ id: r.id });
});
