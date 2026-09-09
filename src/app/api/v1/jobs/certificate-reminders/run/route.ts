import { route } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { generateCertificateReminders } from "@/domain/documents";

/** POST /api/v1/jobs/certificate-reminders/run — idempotent expiry reminder sweep. */
export const POST = route(async ({ principal }) => {
  if (!canAnywhere(principal, "documents.manage")) throw new ForbiddenError("documents.manage");
  return ok(await generateCertificateReminders(principal.userId));
});
