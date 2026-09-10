"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useToast, useI18n } from "@/components/providers";
import { detachFileAction } from "@/app/actions/files";

export function DetachFileButton({ fileId, entityType, entityId }: { fileId: string; entityType: string; entityId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      aria-label={t("detach.detachFile")}
      className="text-ink-3 hover:text-critical disabled:opacity-50"
      onClick={() =>
        start(async () => {
          const res = await detachFileAction(fileId, entityType, entityId);
          if (res.ok) { toast({ kind: "success", title: t("detach.detached") }); router.refresh(); }
          else toast({ kind: "error", title: res.error });
        })
      }
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
