import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { archiveFile } from "@/domain/files";

/** POST /api/v1/files/:id/archive */
export const POST = route<{ id: string }>(async ({ principal, ip, userAgent, params }) => {
  await archiveFile({ principal, ip, userAgent }, params.id);
  return ok({ archived: true });
});
