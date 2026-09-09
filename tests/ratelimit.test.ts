import { describe, it, expect } from "vitest";
import { MemoryRateLimitStore } from "@/lib/ratelimit/memory";

/**
 * §1 rate limiter — fixed-window store behavior. The distributed Upstash store
 * shares the same contract; these lock the window semantics without network.
 */
describe("MemoryRateLimitStore", () => {
  it("increments within a window and resets after it", async () => {
    const store = new MemoryRateLimitStore();
    const a = await store.hit("k", 1000);
    const b = await store.hit("k", 1000);
    expect(a.count).toBe(1);
    expect(b.count).toBe(2);
    expect(b.resetAt).toBe(a.resetAt); // same window
  });

  it("starts a fresh window once the previous one expires", async () => {
    const store = new MemoryRateLimitStore();
    // Simulate an already-expired window by hitting with a 0ms window.
    await store.hit("k2", 0);
    const next = await store.hit("k2", 1000);
    expect(next.count).toBe(1); // reset, not 2
  });

  it("keeps separate counters per key", async () => {
    const store = new MemoryRateLimitStore();
    await store.hit("a", 1000);
    await store.hit("a", 1000);
    const b = await store.hit("b", 1000);
    expect(b.count).toBe(1);
  });

  it("models a limit: first N allowed, N+1 blocked", async () => {
    const store = new MemoryRateLimitStore();
    const limit = 5;
    const results: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const { count } = await store.hit("login:ip:user", 60_000);
      results.push(count <= limit);
    }
    expect(results).toEqual([true, true, true, true, true, false, false]);
  });
});
