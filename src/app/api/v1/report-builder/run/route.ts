import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { runReport } from "@/domain/report-builder";

export const POST = route(async ({ principal, req }) => {
  const body = await req.json().catch(() => { throw new ServiceError("invalid_json", "Invalid JSON", 400); });
  return ok(await runReport(principal, body));
});
