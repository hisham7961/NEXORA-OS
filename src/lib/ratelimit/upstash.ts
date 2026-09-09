import type { RateLimitStore, HitResult } from "./types";

/**
 * Distributed fixed-window store backed by Upstash Redis' REST API (§1). REST +
 * fetch means no client dependency and it works through the outbound proxy. Enabled
 * when NEXORA_UPSTASH_REDIS_REST_URL + NEXORA_UPSTASH_REDIS_REST_TOKEN are set;
 * uses INCR + PEXPIRE (NX) so the window is set once per key. On any transport
 * error it fails OPEN (returns a permissive result) rather than locking users out —
 * availability over strictness for a best-effort limiter.
 */
export class UpstashRateLimitStore implements RateLimitStore {
  readonly name = "upstash";
  constructor(private url: string, private token: string) {}

  private async cmd(args: (string | number)[]): Promise<unknown> {
    const res = await fetch(`${this.url}/${args.map((a) => encodeURIComponent(String(a))).join("/")}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const json = (await res.json()) as { result?: unknown };
    return json.result;
  }

  async hit(key: string, windowMs: number): Promise<HitResult> {
    const now = Date.now();
    try {
      const count = Number(await this.cmd(["INCR", `rl:${key}`]));
      if (count === 1) await this.cmd(["PEXPIRE", `rl:${key}`, windowMs, "NX"]).catch(() => {});
      // Best-effort resetAt (we don't round-trip PTTL to keep it to one call on the hot path).
      return { count, resetAt: now + windowMs };
    } catch {
      // Fail open — never block legitimate traffic because the limiter is down.
      return { count: 1, resetAt: now + windowMs };
    }
  }
}
