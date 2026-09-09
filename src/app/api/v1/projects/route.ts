import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { pageMeta } from "@/lib/api/pagination";
import { listProjects, projectQuerySchema } from "@/domain/projects";
import { createProject } from "@/domain/org-admin";

export const GET = route(async ({ principal, req }) => {
  const query = projectQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total } = await listProjects(principal, query);
  return ok(rows, pageMeta(total, query));
});
export const POST = route(async ({ principal, ip, userAgent, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Request body must be valid JSON", 400); });
  return ok(await createProject({ principal, ip, userAgent }, body));
});
