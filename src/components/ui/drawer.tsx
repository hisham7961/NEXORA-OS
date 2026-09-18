"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Side drawer for quick create/edit and detail peeks (§43, §78 — never a giant
 * modal). Locale-aware: slides from the inline-end edge (right in LTR, left in RTL).
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  width = "480px",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    // Remember what had focus so we can restore it on close (audit UX-14).
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const visibleFocusable = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null);

    // Move focus into the drawer.
    (visibleFocusable()[0] ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panel) return;
      // Trap Tab within the drawer.
      const nodes = visibleFocusable();
      if (nodes.length === 0) { e.preventDefault(); panel.focus(); return; }
      const first = nodes[0], last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.(); // restore focus to the trigger
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-[var(--overlay)] animate-fade-in" onClick={onClose} />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative flex h-full w-full flex-col border-s border-line bg-surface shadow-lg animate-slide-up focus:outline-none"
        style={{ maxWidth: width }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-ink truncate">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={t("actions.close")}>
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className={cn("border-t border-line px-5 py-3")}>{footer}</footer>}
      </aside>
    </div>
  );
}
