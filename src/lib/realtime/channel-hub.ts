import { prisma } from "@/lib/db";

/**
 * Shared change-signal hub for discussion channels (audit PLAT-04). The live SSE
 * route used to run a DB aggregate every few seconds PER open connection, so load
 * scaled with the number of viewers — unbounded. Here a single poller per channel
 * fans its signal out to every subscriber, so DB work scales with the number of
 * distinct watched channels instead of connections. No external pub/sub infra.
 *
 * The signal ("<maxCreated>:<maxEdited>:<count>") advances on any new message,
 * edit, or deletion; subscribers then pull the authoritative list via RSC. Access
 * control stays in the route (getChannel) — the hub only polls and fans out.
 */
const POLL_MS = 3000;
/** Safety cap on distinct watched channels held in-process. */
const MAX_CHANNELS = 1000;

type Listener = (signal: string) => void;
interface Entry {
  signal: string;
  listeners: Set<Listener>;
  timer: ReturnType<typeof setInterval> | null;
}

// Survive HMR / module reloads in dev by pinning to globalThis.
const g = globalThis as unknown as { __nexoraChannelHub?: Map<string, Entry> };
const hub: Map<string, Entry> = g.__nexoraChannelHub ?? new Map<string, Entry>();
g.__nexoraChannelHub = hub;

export async function channelChangeSignal(channelId: string): Promise<string> {
  const agg = await prisma.message.aggregate({
    where: { channelId, archivedAt: null },
    _max: { createdAt: true, editedAt: true },
    _count: { _all: true },
  });
  const created = agg._max.createdAt?.getTime() ?? 0;
  const edited = agg._max.editedAt?.getTime() ?? 0;
  return `${created}:${edited}:${agg._count._all}`;
}

/** Run one poll for a channel and fan a changed signal out to its listeners. */
export async function pollChannelNow(channelId: string): Promise<void> {
  const entry = hub.get(channelId);
  if (!entry) return;
  try {
    const cur = await channelChangeSignal(channelId);
    if (cur !== entry.signal) {
      entry.signal = cur;
      for (const l of entry.listeners) l(cur);
    }
  } catch {
    /* keep the stream alive across transient DB blips */
  }
}

/**
 * Subscribe to a channel's change signal. Returns the current (primed) signal and
 * an unsubscribe fn. The first subscriber starts the shared poller; the last one to
 * leave stops it. All subscribers to a channel share a single DB poll per interval.
 */
export function subscribeChannelSignal(channelId: string, onChange: Listener): { primed: Promise<string>; unsubscribe: () => void } {
  let entry = hub.get(channelId);
  let primed: Promise<string>;

  if (!entry) {
    // Over the safety cap: don't start another poller — prime once, never update.
    // (Pathological load only; normal usage stays far below the cap.)
    if (hub.size >= MAX_CHANNELS) {
      return { primed: channelChangeSignal(channelId).catch(() => ""), unsubscribe: () => {} };
    }
    const e: Entry = { signal: "", listeners: new Set(), timer: null };
    hub.set(channelId, e);
    entry = e;
    primed = channelChangeSignal(channelId).then((s) => { e.signal = s; return s; }).catch(() => "");
    e.timer = setInterval(() => { void pollChannelNow(channelId); }, POLL_MS);
    // Don't keep the process alive just for this poller.
    (e.timer as { unref?: () => void }).unref?.();
  } else {
    primed = Promise.resolve(entry.signal);
  }

  const captured = entry;
  captured.listeners.add(onChange);

  return {
    primed,
    unsubscribe: () => {
      captured.listeners.delete(onChange);
      if (captured.listeners.size === 0) {
        if (captured.timer) clearInterval(captured.timer);
        hub.delete(channelId);
      }
    },
  };
}

/** Test/telemetry: number of distinct channels currently polled. */
export function channelHubSize(): number {
  return hub.size;
}
