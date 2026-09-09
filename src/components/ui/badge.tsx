import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { statusMeta, type StatusCategory } from "@/lib/status";

const CATEGORY_STYLES: Record<StatusCategory, string> = {
  neutral: "bg-neutral-soft text-ink-2",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  critical: "bg-critical-soft text-critical",
};

export function Badge({
  children,
  category = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  category?: StatusCategory;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap",
        CATEGORY_STYLES[category],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

/** Status pill driven by the central status registry (§46). */
export function StatusBadge({
  module,
  status,
  className,
}: {
  module: string;
  status: string | null | undefined;
  className?: string;
}) {
  const meta = statusMeta(module, status);
  return (
    <Badge category={meta.category} dot className={className}>
      {meta.label}
    </Badge>
  );
}
