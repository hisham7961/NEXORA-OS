import { route, ServiceError } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { checkIn, startBreak, endBreak, checkOut } from "@/domain/attendance";

const ACTIONS: Record<string, (ctx: { principal: any; ip: string | null; userAgent: string | null }) => Promise<void>> = {
  "check-in": checkIn,
  "break-start": startBreak,
  "break-end": endBreak,
  "check-out": checkOut,
};

/** POST /api/v1/attendance/{check-in|break-start|break-end|check-out} */
export const POST = route<{ action: string }>(async ({ principal, ip, userAgent, params }) => {
  const fn = ACTIONS[params.action];
  if (!fn) throw new ServiceError("bad_action", "Unknown attendance action", 400);
  await fn({ principal, ip, userAgent });
  return ok({ action: params.action });
});
