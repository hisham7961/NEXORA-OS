import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-3">
        <Compass className="h-5 w-5" />
      </div>
      <h1 className="text-lg font-semibold text-ink">Page not found</h1>
      <p className="mt-1.5 max-w-sm text-[13px] text-ink-2">
        The page you're looking for doesn't exist or may be outside your access scope.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex h-9 items-center rounded-md bg-accent px-4 text-[13px] font-medium text-on-accent hover:bg-accent-hover"
      >
        Back to Command Center
      </Link>
    </div>
  );
}
