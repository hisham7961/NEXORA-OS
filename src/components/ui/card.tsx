import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface shadow-sm", className)}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 py-3 border-b border-line", className)}>
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <span className="mt-0.5 text-ink-3 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-ink truncate">{title}</h3>
          {description && <p className="text-xs text-ink-3 mt-0.5">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PanelBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
