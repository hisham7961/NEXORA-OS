import type { RateLimitStore, HitResult } from "./types";

/**
 * In-process fixed-window store — the safe development / single-instance fallback.
 * Not suitable as the ONLY production limiter across multiple instances (each
 * process keeps its own counters); production should configure a distributed store
 * (see upstash.ts). A periodic sweep drops expired windows so the map stays small.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  readonly name = "memory";
  private windows = new Map<string, HitResult>();
  private lastSweep = Date.now();

  async hit(key: string, windowMs: number): Promise<HitResult> {
    const now = Date.now();
    if (now - this.lastSweep > 60_000) this.sweep(now);
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.windows.set(key, fresh);
      return { ...fresh };
    }
    existing.count += 1;
    return { ...existing }; // return a snapshot, not the live window object
  }

  private sweep(now: number): void {
    this.lastSweep = now;
    for (const [k, v] of this.windows) if (v.resetAt <= now) this.windows.delete(k);
  }
}
