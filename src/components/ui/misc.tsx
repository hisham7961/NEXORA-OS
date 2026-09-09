import type { ReactNode } from "react";
import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  color,
  size = 28,
  className,
}: {
  name: string;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: color ?? "var(--accent)",
      }}
    >
      {initials(name)}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface-2 px-1 text-[10.5px] font-medium text-ink-3">
      {children}
    </kbd>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-10 px-6", className)}>
      {icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink-3">
          {icon}
        </div>
      )}
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-ink-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-5">
      {breadcrumb && <div className="mb-2 text-xs text-ink-3">{breadcrumb}</div>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {meta && <div className="mt-3">{meta}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} />;
}

/** Small labelled metric used sparingly (§41: avoid a wall of KPI cards). */
export function Metric({
  label,
  value,
  sub,
  category,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  category?: "neutral" | "info" | "success" | "warning" | "critical";
}) {
  const color =
    category === "critical" ? "text-critical"
    : category === "warning" ? "text-warning"
    : category === "success" ? "text-success"
    : "text-ink";
  return (
    <div className="min-w-0">
      <div className="text-xs text-ink-3">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tabular tracking-tight", color)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}
