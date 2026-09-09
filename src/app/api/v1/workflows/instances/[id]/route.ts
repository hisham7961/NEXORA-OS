import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getInstance } from "@/domain/workflows";

export const GET = route<{ id: string }>(async ({ principal, params }) => {
  const inst = await getInstance(principal, params.id);
  if (!inst) throw new ServiceError("not_found", "Workflow instance not found", 404);
  return ok(inst);
});
