"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/providers";
import { runJobAction } from "@/app/actions/jobs";

/** "Run now" / retry a scheduled job from the Operations Center. */
export function RunJobButton({ name, failed }: { name: string; failed?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  return (
    <Button size="sm" variant={failed ? "secondary" : "ghost"} disabled={pending} onClick={async () => {
      setPending(true);
      const r = await runJobAction(name);
      setPending(false);
      if (r.ok) { toast({ kind: "success", title: `Ran in ${r.data?.durationMs ?? 0}ms` }); router.refresh(); }
      else toast({ kind: "error", title: r.error });
    }}>
      {failed ? <RefreshCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {pending ? "Running…" : failed ? "Retry" : "Run now"}
    </Button>
  );
}
