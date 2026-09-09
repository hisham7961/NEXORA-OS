import { Panel, PanelHeader, EmptyState } from "@/components/ui";
import { humanize } from "@/lib/status";

export interface CoverageData {
  dayKeys: string[];
  platforms: string[];
  grid: Record<string, Record<string, number>>;
  total: number;
}

/** Platform × day coverage heat grid for the next N days — gaps read as empty. */
export function CoverageMatrix({ data, locale }: { data: CoverageData; locale: "en" | "ar" }) {
  if (data.total === 0) {
    return (
      <Panel className="mb-4">
        <PanelHeader title="Coverage" description="Planned items per platform over the next 7 days." />
        <EmptyState title="Nothing planned in the next week" description="Plan posts and stories, or generate a recurring plan, to fill the calendar." />
      </Panel>
    );
  }
  const dayLabel = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(locale === "ar" ? "ar" : "en", { weekday: "short", day: "numeric" });

  return (
    <Panel className="mb-4">
      <PanelHeader title="Coverage" description="Planned items per platform over the next 7 days — empty cells are gaps." />
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky start-0 bg-surface px-3 py-2 text-start text-[11px] font-semibold uppercase tracking-wide text-ink-3">Platform</th>
              {data.dayKeys.map((d) => (
                <th key={d} className="px-2 py-2 text-center text-[11px] font-medium text-ink-2 whitespace-nowrap">{dayLabel(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.platforms.map((p) => (
              <tr key={p} className="border-b border-line">
                <td className="sticky start-0 bg-surface px-3 py-1.5 font-medium text-ink-2 capitalize">{humanize(p)}</td>
                {data.dayKeys.map((d) => {
                  const n = data.grid[p]?.[d] ?? 0;
                  return (
                    <td key={d} className="px-2 py-1.5 text-center">
                      {n > 0 ? (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-accent-soft px-1.5 text-[12px] font-semibold text-accent tabular-nums">{n}</span>
                      ) : (
                        <span className="mx-auto block h-1 w-1 rounded-full bg-line-strong" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
