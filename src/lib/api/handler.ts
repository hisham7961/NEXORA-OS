import { NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { User } from "@prisma/client";
import { getCurrentUser, getPrincipal } from "@/lib/auth/current-user";
import { ForbiddenError, UnauthorizedError, type Principal } from "@/lib/permissions/engine";
import { rateLimit, tooManyRequests, type BucketName } from "@/lib/ratelimit";
import { fail } from "./response";

/** Choose the rate-limit bucket for an API path (§1). */
function bucketForPath(pathname: string, method: string): BucketName {
  if (/\/api\/v1\/(accounting|finance|expenses|subscriptions)\//.test(pathname) && method !== "GET") return "finance_post";
  if (/\/api\/v1\/(accounting|finance|permissions|users|developer|admin)/.test(pathname)) return "api_sensitive";
  if (/\/api\/v1\/.+\/download/.test(pathname)) return "file_restricted";
  return "api";
}

export interface ApiContext<P = Record<string, string>> {
  req: NextRequest;
  params: P;
  principal: Principal;
  user: User;
  ip: string | null;
  userAgent: string | null;
}

type Handler<P> = (ctx: ApiContext<P>) => Promise<Response> | Response;

/**
 * Wrap a route handler with authentication, request context and uniform error
 * mapping. The SAME service layer and permission checks the web app uses run
 * here, so the future mobile app gets identical behavior (§33, §57).
 */
export function route<P extends Record<string, string> = Record<string, string>>(
  handler: Handler<P>,
  opts: { auth?: boolean } = {},
) {
  const authRequired = opts.auth !== false;

  return async (req: NextRequest, segment: { params: Promise<P> }): Promise<Response> => {
    try {
      const params = (await segment.params) ?? ({} as P);
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const userAgent = req.headers.get("user-agent");

      const principal = await getPrincipal();
      const user = await getCurrentUser();
      if (authRequired && (!principal || !user)) {
        throw new UnauthorizedError();
      }

      // Rate limiting (§1): keyed by the authenticated user when known, else IP.
      // Sensitive/finance/download paths get tighter buckets (see bucketForPath).
      const pathname = new URL(req.url).pathname;
      const identity = principal?.userId ?? ip ?? "anon";
      const rl = await rateLimit(bucketForPath(pathname, req.method), `${identity}:${req.method}:${pathname}`);
      if (!rl.allowed) return tooManyRequests(rl);

      return await handler({
        req,
        params,
        principal: principal as Principal,
        user: user as User,
        ip,
        userAgent,
      });
    } catch (err) {
      return mapError(err);
    }
  };
}

export function mapError(err: unknown): Response {
  if (err instanceof UnauthorizedError) return fail(err.code, err.message, 401);
  if (err instanceof ForbiddenError) return fail(err.code, err.message, 403);
  if (err instanceof ZodError) {
    return fail("validation_error", "Request validation failed", 422, err.flatten());
  }
  if (err instanceof ServiceError) return fail(err.code, err.message, err.status, err.details);
  console.error("[api] unhandled error", err);
  // Never leak stack traces to clients (§66).
  return fail("internal_error", "An unexpected error occurred", 500);
}

/** Domain-level error the service layer can throw with a stable code + status. */
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ServiceError("invalid_json", "Request body must be valid JSON", 400);
  }
  return schema.parse(json);
}
