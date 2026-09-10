"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { verifyChecklistInstanceAction, runDailyGeneratorAction } from "@/app/actions/daily-checks";

export function VerifyButton({ instanceId }: { instanceId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
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
            toast({ kind: "success", title: t("ma.verified") });
            router.refresh();
          } else toast({ kind: "error", title: res.error });
        })
      }
    >
      <BadgeCheck className="h-4 w-4" /> {t("ma.verify")}
    </Button>
  );
}

export function RunGeneratorButton() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
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
            toast({ kind: "success", title: t("ma.generatorRan"), description: t("ma.generatorSummary", { created: d?.created ?? 0, skipped: d?.skipped ?? 0 }) });
            router.refresh();
          } else toast({ kind: "error", title: res.error });
        })
      }
    >
      <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> {t("ma.runGenerator")}
    </Button>
  );
}
