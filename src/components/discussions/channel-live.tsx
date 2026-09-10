"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Subscribes to the channel's SSE stream (§21-22 realtime) and refreshes the RSC
 * route when another user posts, edits, or deletes a message — so the open channel
 * updates live without a manual reload. The stream sends a baseline `sync` event
 * (recorded, not acted on) followed by `change` events; we debounce refreshes so a
 * burst of activity coalesces into one pull. EventSource auto-reconnects if the
 * connection drops or the server caps the stream, so no manual retry loop is needed.
 */
export function ChannelLive({ channelId }: { channelId: string }) {
  const router = useRouter();
  const seenBaseline = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    seenBaseline.current = false;
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/v1/discussions/${channelId}/live`);
    } catch {
      return; // EventSource unsupported — the page still works, just without live updates
    }

    const refreshSoon = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => router.refresh(), 250);
    };

    es.addEventListener("sync", () => { seenBaseline.current = true; });
    es.addEventListener("change", () => { if (seenBaseline.current) refreshSoon(); });
    // If the browser reconnects mid-session it re-sends `sync` first, so the guard
    // above still prevents a spurious refresh on every reconnect.

    return () => {
      es?.close();
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [channelId, router]);

  return null;
}
