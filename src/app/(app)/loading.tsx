import { Skeleton } from "@/components/ui";

/** Polished skeleton loading state (§66). */
export default function Loading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface p-4 lg:col-span-2">
          <Skeleton className="mb-4 h-4 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <Skeleton className="mb-4 h-4 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
