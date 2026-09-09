"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/providers";
import { verifyChecklistInstanceAction, runDailyGeneratorAction } from "@/app/actions/daily-checks";

export function VerifyButton({ instanceId }: { instanceId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await verifyChecklistInstanceAction(instanceId);
          if (res.ok) {
            toast({ kind: "success", title: "Verified" });
            router.refresh();
          } else toast({ kind: "error", title: res.error });
        })
      }
    >
      <BadgeCheck className="h-4 w-4" /> Verify
    </Button>
  );
}

export function RunGeneratorButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await runDailyGeneratorAction();
          if (res.ok) {
            const d = res.data;
            toast({ kind: "success", title: "Generator ran", description: `${d?.created ?? 0} created · ${d?.skipped ?? 0} skipped` });
            router.refresh();
          } else toast({ kind: "error", title: res.error });
        })
      }
    >
      <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> Run generator
    </Button>
  );
}
