import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  headerClassName?: string;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  getRowHref?: (row: T) => string;
  empty?: ReactNode;
  stickyHeader?: boolean;
  className?: string;
}

const alignClass = { start: "text-start", center: "text-center", end: "text-end" } as const;

/**
 * Dense, professional data table (§43, §45): thin lines, sticky header, tabular
 * numerals, row hover, optional row navigation. Avoids the "every row in a card"
 * anti-pattern (§45).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  getRowHref,
  empty,
  stickyHeader = false,
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <div className="p-8">{empty}</div>;
  }

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-[13px] tabular">
        <thead className={cn(stickyHeader && "sticky top-0 z-10")}>
          <tr className="bg-surface-2/70 backdrop-blur">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3 border-b border-line",
                  alignClass[col.align ?? "start"],
                  col.headerClassName,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = getRowHref?.(row);
            return (
              <tr
                key={getRowKey(row)}
                className={cn(
                  "border-b border-line last:border-0 transition-colors",
                  href ? "hover:bg-surface-2 cursor-pointer group" : "hover:bg-surface-2/60",
                )}
              >
                {columns.map((col, ci) => {
                  const content = col.render ? col.render(row) : (row as Record<string, ReactNode>)[col.key];
                  return (
                    <td
                      key={col.key}
                      className={cn("px-3 py-2.5 text-ink align-middle", alignClass[col.align ?? "start"], col.className)}
                    >
                      {href && ci === 0 ? (
                        <Link href={href} className="block -mx-3 -my-2.5 px-3 py-2.5 font-medium">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
