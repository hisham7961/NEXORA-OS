import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { subscribeChannelSignal, pollChannelNow, channelHubSize } from "@/lib/realtime/channel-hub";

/**
 * Regression for audit PLAT-04: the live-channel SSE poll must be shared across
 * viewers, not run once per connection. Two subscribers to one channel keep exactly
 * ONE poller (DB work scales with channels, not connections); a change fans out to
 * both; the poller stops when the last subscriber leaves.
 *
 * DB-gated: the hub reads message rows, so this needs Postgres.
 */
const P = "hubtest_";
const chan = P + "chan";
let dbUp = false;

beforeAll(async () => {
  try { await prisma.$queryRaw`select 1`; dbUp = true; } catch { dbUp = false; return; }
  await cleanup();
  await prisma.channel.create({ data: { id: chan, name: "Hub Test" } });
  await prisma.message.create({ data: { channelId: chan, authorId: P + "u", body: "first" } });
});
afterAll(async () => { if (dbUp) await cleanup(); });
async function cleanup() {
  await prisma.message.deleteMany({ where: { channelId: chan } }).catch(() => {});
  await prisma.channel.deleteMany({ where: { id: chan } }).catch(() => {});
}

describe("PLAT-04 — channel SSE poll is shared across viewers", () => {
  it("coalesces subscribers, fans out changes, and stops on last leave", async () => {
    if (!dbUp) return;
    const before = channelHubSize();
    const aSignals: string[] = [];
    const bSignals: string[] = [];

    const a = subscribeChannelSignal(chan, (s) => aSignals.push(s));
    const b = subscribeChannelSignal(chan, (s) => bSignals.push(s));
    await Promise.all([a.primed, b.primed]);

    // Two viewers → exactly one new poller entry (not two). This is the PLAT-04 fix.
    expect(channelHubSize()).toBe(before + 1);

    // A new message advances the signal; one shared poll fans out to BOTH listeners.
    await prisma.message.create({ data: { channelId: chan, authorId: P + "u", body: "second" } });
    await pollChannelNow(chan);
    expect(aSignals.length).toBe(1);
    expect(bSignals.length).toBe(1);
    expect(aSignals[0]).toBe(bSignals[0]);

    // No change → no extra fanout.
    await pollChannelNow(chan);
    expect(aSignals.length).toBe(1);

    // Poller stays while any subscriber remains, stops when the last one leaves.
    a.unsubscribe();
    expect(channelHubSize()).toBe(before + 1);
    b.unsubscribe();
    expect(channelHubSize()).toBe(before);
  });
});
