import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

/**
 * Server-rendered tab bar for entity 360 pages (§44). The active tab is carried
 * in the URL (?tab=) so views are shareable and each tab's content is rendered
 * server-side (§77 URL-based state).
 */
export function TabBar({
  tabs,
  current,
  className,
}: {
  tabs: TabItem[];
  current: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5 overflow-x-auto border-b border-line", className)}>
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={`?tab=${tab.key}`}
            scroll={false}
            className={cn(
              "relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors",
              active ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10.5px] tabular",
                  active ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-3",
                )}
              >
                {tab.count}
              </span>
            )}
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </Link>
        );
      })}
    </div>
  );
}
