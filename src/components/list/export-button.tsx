"use client";

import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/providers";

/** Export the current list/report to CSV, carrying the same filters/company as the screen. */
export function ExportButton({ resource, label }: { resource: string; label?: string }) {
  const { t } = useI18n();
  label = label ?? t("actions.export");
  const params = useSearchParams();
  const href = `/api/v1/export/${resource}${params.toString() ? `?${params.toString()}` : ""}`;
  return (
    <a href={href} download>
      <Button variant="ghost" size="sm"><Download className="h-4 w-4" /> {label}</Button>
    </a>
  );
}
