import type { NextRequest } from "next/server";
import { getPrincipal } from "@/lib/auth/current-user";
import { getChannel } from "@/domain/discussions";
import { subscribeChannelSignal } from "@/lib/realtime/channel-hub";
import { ForbiddenError } from "@/lib/permissions/engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/discussions/:id/live — Server-Sent Events stream for live channel
 * updates (§21-22 realtime). Poll-backed (no external pub/sub infra), but the DB
 * poll is SHARED across all viewers of a channel via the channel hub (audit
 * PLAT-04): one aggregate per channel per interval, fanned out to every connection,
 * instead of one query per connection. On a change the client pulls the
 * authoritative message list via the RSC route. Access is enforced through
 * getChannel() exactly like the read routes; the first `sync` event is a baseline
 * the client ignores. A per-connection heartbeat (no DB) keeps the socket alive.
 */
const HEARTBEAT_MS = 15000; // socket keep-alive only — does NO database work
const MAX_MS = 25 * 60 * 1000; // hard cap; the client reconnects (EventSource auto-retries)

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const principal = await getPrincipal();
  if (!principal) return new Response("Unauthorized", { status: 401 });
  try {
    const channel = await getChannel(principal, id);
    if (!channel) return new Response("Not found", { status: 404 });
  } catch (e) {
    if (e instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw e;
  }

  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;
  const stop = () => {
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    unsubscribe?.();
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`)); }
        catch { stop(); }
      };

      // Share this channel's DB poll with every other viewer (PLAT-04). A changed
      // signal is pushed to us by the hub; we do no polling of our own.
      const sub = subscribeChannelSignal(id, (signal) => send("change", signal));
      unsubscribe = sub.unsubscribe;
      sub.primed.then((baseline) => send("sync", baseline)); // client records, does not act

      const started = Date.now();
      heartbeat = setInterval(() => {
        if (closed) return;
        if (Date.now() - started > MAX_MS) { send("bye", "1"); stop(); try { controller.close(); } catch { /* already closed */ } return; }
        try { controller.enqueue(encoder.encode(`: ping\n\n`)); } // keep-alive only; no DB
        catch { stop(); }
      }, HEARTBEAT_MS);
    },
    cancel() { stop(); },
  });

  req.signal.addEventListener("abort", stop);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
