/**
 * Rate-limit abstraction (Phase 3 §1). Business/route code depends only on
 * `rateLimit()` — never on a concrete store — so the in-process dev store can be
 * swapped for a distributed (Upstash-REST/Redis) store by configuration alone, the
 * same pattern as the storage driver. Fixed-window counters keyed by bucket+identity.
 */
export interface HitResult {
  count: number; // hits so far in the current window (including this one)
  resetAt: number; // epoch ms when the window resets
}

export interface RateLimitStore {
  readonly name: string;
  /** Atomically increment the counter for `key`, creating a `windowMs` window. */
  hit(key: string, windowMs: number): Promise<HitResult>;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number; // seconds until the window resets (0 when allowed with room)
  resetAt: number;
}
