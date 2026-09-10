import { Skeleton } from "@/components/ui";

/** Loading state for the auth group so navigation to /login shows a placeholder. */
export default function AuthLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-surface p-6 shadow-md">
        <Skeleton className="mx-auto h-12 w-12 rounded-xl" />
        <Skeleton className="mx-auto h-5 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}
