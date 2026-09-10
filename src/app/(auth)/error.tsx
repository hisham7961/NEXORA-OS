"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/** Error boundary for the auth (login) group — no app chrome exists here (§66). */
export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[auth] rendering error", error); }, [error]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-critical-soft text-critical">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h1 className="text-base font-semibold text-ink">Sign-in is temporarily unavailable</h1>
      <p className="mt-1.5 max-w-sm text-[13px] text-ink-2">Please retry in a moment. If it persists, contact an administrator.</p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-ink-3">Reference: {error.digest}</p>}
      <button onClick={() => reset()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[14px] font-medium text-on-accent hover:bg-accent-hover">
        <RotateCw className="h-4 w-4" /> Retry
      </button>
    </div>
  );
}
