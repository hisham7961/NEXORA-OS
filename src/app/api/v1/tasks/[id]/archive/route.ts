import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { archiveTask } from "@/domain/tasks";

/** POST /api/v1/tasks/[id]/archive — soft-delete a task (§30 parity). */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await archiveTask({ principal, ip, userAgent }, params.id);
  return ok({ id: params.id, archived: true });
});
