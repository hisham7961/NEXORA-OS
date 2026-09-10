import type { NextRequest } from "next/server";
import { getPrincipal } from "@/lib/auth/current-user";
import { getChannel } from "@/domain/discussions";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/permissions/engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/discussions/:id/live — Server-Sent Events stream for live channel
 * updates (§21-22 realtime). Poll-backed (no external pub/sub infra): every few
 * seconds it re-reads a cheap change signal for the channel — the newest message
 * timestamp plus the message count, which together catch new messages and
 * deletions — and pushes a `change` event when it advances. The client then pulls
 * the authoritative message list via the RSC route (router.refresh()). Access is
 * enforced through getChannel() exactly like the read routes; the first `sync`
 * event is a baseline the client ignores. Heartbeat comments keep the connection
 * from idling out.
 */
const POLL_MS = 3000;
const MAX_MS = 25 * 60 * 1000; // hard cap; the client reconnects (EventSource auto-retries)

async function changeSignal(channelId: string): Promise<string> {
  const agg = await prisma.message.aggregate({
    where: { channelId, archivedAt: null },
    _max: { createdAt: true, editedAt: true },
    _count: { _all: true },
  });
  const created = agg._max.createdAt?.getTime() ?? 0;
  const edited = agg._max.editedAt?.getTime() ?? 0;
  return `${created}:${edited}:${agg._count._all}`;
}

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
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => { closed = true; if (timer) clearInterval(timer); };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`)); }
        catch { stop(); }
      };
      let last = "";
      try { last = await changeSignal(id); } catch { /* transient */ }
      send("sync", last); // baseline the client records but does not act on

      const started = Date.now();
      timer = setInterval(async () => {
        if (closed) return;
        if (Date.now() - started > MAX_MS) { send("bye", "1"); stop(); try { controller.close(); } catch { /* already closed */ } return; }
        try {
          const cur = await changeSignal(id);
          if (cur !== last) { last = cur; send("change", cur); }
          else controller.enqueue(encoder.encode(`: ping\n\n`)); // heartbeat comment
        } catch { /* keep the stream alive across transient DB blips */ }
      }, POLL_MS);
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
