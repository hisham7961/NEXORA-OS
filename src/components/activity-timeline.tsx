import { Avatar } from "@/components/ui";
import { humanize } from "@/lib/status";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/i18n";

export interface TimelineEntry {
  id: string;
  at: Date;
  actorName: string;
  actorColor?: string | null;
  action: string;
  summary?: string | null;
}

/** Readable activity timeline (§47) — sourced from the audit trail, never raw JSON. */
export function ActivityTimeline({ entries, locale, empty }: { entries: TimelineEntry[]; locale: Locale; empty?: string }) {
  if (entries.length === 0) {
    return <p className="px-4 py-6 text-[13px] text-ink-3">{empty ?? "No activity yet."}</p>;
  }
  return (
    <ol className="relative ms-3 space-y-4 border-s border-line ps-5 py-1">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -start-[27px] top-0.5">
            <Avatar name={e.actorName} color={e.actorColor} size={18} />
          </span>
          <div className="text-[13px] text-ink">
            <span className="font-medium">{e.actorName}</span>{" "}
            <span className="text-ink-2">{humanize(e.action.replace(/\./g, " "))}</span>
          </div>
          {e.summary && <div className="text-xs text-ink-2">{e.summary}</div>}
          <div className="text-[11px] text-ink-3">{formatDateTime(e.at, locale)}</div>
        </li>
      ))}
    </ol>
  );
}
