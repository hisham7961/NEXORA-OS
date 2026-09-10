import { Skeleton } from "@/components/ui";

/**
 * Tailored loading skeleton for the accounting section — metric cards over a table,
 * matching its dashboards/ledgers rather than the generic dashboard-card skeleton.
 */
export default function AccountingLoading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-4">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-6 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-4 py-3"><Skeleton className="h-4 w-40" /></div>
        <div className="divide-y divide-line">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
