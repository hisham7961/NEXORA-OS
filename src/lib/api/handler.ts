import { NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { User } from "@prisma/client";
import { getCurrentUser, getPrincipal } from "@/lib/auth/current-user";
import { ForbiddenError, UnauthorizedError, type Principal } from "@/lib/permissions/engine";
import { rateLimit, tooManyRequests, type BucketName } from "@/lib/ratelimit";
import { fail } from "./response";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Same-origin guard for cookie-authenticated state-changing requests (§31 CSRF).
 * A SameSite=Lax cookie still rides along on top-level cross-site POSTs, so we also
 * require the Origin (or, failing that, Referer) host to match the request host.
 * Bearer-token requests skip this — they carry no ambient cookie credential.
 */
function isSameOrigin(req: NextRequest): boolean {
  const host = req.headers.get("host");
  if (!host) return false;
  const source = req.headers.get("origin") ?? req.headers.get("referer");
  if (!source) return false; // browsers send Origin on state-changing requests; absence is suspicious
  try { return new URL(source).host === host; } catch { return false; }
}

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

      // Authenticate: a Bearer API token takes precedence over the session cookie
      // (§32). Token requests carry no ambient credential, so they are exempt from
      // the CSRF origin check; cookie requests are not.
      let principal: Principal | null = null;
      let user: User | null = null;
      const bearer = req.headers.get("authorization");
      const bearerToken = bearer?.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : null;

      if (bearerToken) {
        const { authenticateApiToken } = await import("@/domain/api-tokens");
        const authed = await authenticateApiToken(bearerToken);
        if (!authed) throw new UnauthorizedError();
        if (authed.readOnly && !SAFE_METHODS.has(req.method)) {
          throw new ForbiddenError("api_token.read_only");
        }
        principal = authed.principal;
        user = authed.user;
      } else {
        principal = await getPrincipal();
        user = await getCurrentUser();
        // CSRF: reject cross-origin state-changing requests authenticated by cookie.
        if (principal && !SAFE_METHODS.has(req.method) && !isSameOrigin(req)) {
          throw new ForbiddenError("csrf_origin_mismatch");
        }
      }

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
