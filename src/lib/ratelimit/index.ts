import type { RateLimitStore, RateLimitResult } from "./types";
import { MemoryRateLimitStore } from "./memory";
import { UpstashRateLimitStore } from "./upstash";

export type { RateLimitResult } from "./types";

/**
 * Rate limiting (§1). Named buckets carry a limit + window; `rateLimit()` is the
 * single entry point used by the API route wrapper, the login action and any
 * sensitive mutation. Distributed store when configured, in-process fallback
 * otherwise. Abuse (many blocks for one identity) is surfaced as a SystemEvent for
 * Operations Center visibility.
 */
export interface BucketConfig {
  limit: number;
  windowMs: number;
}

export const BUCKETS = {
  auth_login: { limit: 10, windowMs: 5 * 60_000 }, // 10 attempts / 5 min per ip+email
  api: { limit: 300, windowMs: 60_000 }, // general API, per identity / minute
  api_sensitive: { limit: 60, windowMs: 60_000 }, // finance/accounting/permissions/users/tokens
  finance_post: { limit: 30, windowMs: 60_000 }, // posting / financial mutations
  file_restricted: { limit: 60, windowMs: 60_000 }, // restricted file downloads
  token_write: { limit: 20, windowMs: 60_000 },
} as const satisfies Record<string, BucketConfig>;

export type BucketName = keyof typeof BUCKETS;

let store: RateLimitStore | null = null;
function getStore(): RateLimitStore {
  if (store) return store;
  const url = process.env.NEXORA_UPSTASH_REDIS_REST_URL;
  const token = process.env.NEXORA_UPSTASH_REDIS_REST_TOKEN;
  store = url && token ? new UpstashRateLimitStore(url.replace(/\/$/, ""), token) : new MemoryRateLimitStore();
  return store;
}

/** Whether a distributed store is active (for Ops/health display). */
export function rateLimitBackend(): string {
  return getStore().name;
}

// Per-process guard so we log at most one SystemEvent per identity per minute.
const abuseLogged = new Map<string, number>();

/**
 * Check + record one hit against a bucket for `identifier`. `allowed=false` means
 * the caller should reject with 429 + Retry-After. Overriding limits is supported
 * for finer-grained action buckets.
 */
export async function rateLimit(bucket: BucketName, identifier: string, override?: Partial<BucketConfig>): Promise<RateLimitResult> {
  const cfg = { ...BUCKETS[bucket], ...override };
  const key = `${bucket}:${identifier}`;
  const { count, resetAt } = await getStore().hit(key, cfg.windowMs);
  const allowed = count <= cfg.limit;
  const retryAfterSec = allowed ? 0 : Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  if (!allowed && count === cfg.limit + 1) {
    // First breach in this window — record a security event once.
    const last = abuseLogged.get(key) ?? 0;
    if (Date.now() - last > 60_000) {
      abuseLogged.set(key, Date.now());
      const { prisma } = await import("@/lib/db");
      await prisma.systemEvent.create({
        data: { type: "error", level: "warning", message: `rate limit exceeded: ${bucket}`, metaJson: JSON.stringify({ bucket, identifier: identifier.slice(0, 80), limit: cfg.limit }) },
      }).catch(() => {});
    }
  }
  return { allowed, limit: cfg.limit, remaining: Math.max(0, cfg.limit - count), retryAfterSec, resetAt };
}

/** Standard 429 response body + headers for API routes. */
export function tooManyRequests(result: RateLimitResult): Response {
  return new Response(JSON.stringify({ ok: false, error: { code: "rate_limited", message: "Too many requests. Please slow down." } }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(result.retryAfterSec),
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    },
  });
}
