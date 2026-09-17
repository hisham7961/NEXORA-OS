"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/providers";

/** Polished error boundary — never exposes a raw stack trace to the user (§66). */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error("[app] rendering error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-critical-soft text-critical">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h1 className="text-base font-semibold text-ink">{t("errors.somethingWrong")}</h1>
      <p className="mt-1.5 max-w-sm text-[13px] text-ink-2">{t("errors.unexpected")}</p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-ink-3">{t("errors.reference")}: {error.digest}</p>}
      <Button variant="primary" className="mt-4" onClick={() => reset()}>
        <RotateCw className="h-4 w-4" /> {t("actions.retry")}
      </Button>
    </div>
  );
}
