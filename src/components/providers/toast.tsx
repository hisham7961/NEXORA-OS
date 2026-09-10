"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (t: { kind?: ToastKind; title: string; description?: string }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let counter = 0;

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TONE = {
  success: "text-success",
  error: "text-critical",
  info: "text-info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t: tr } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (t: { kind?: ToastKind; title: string; description?: string }) => {
      const id = ++counter;
      setToasts((ts) => [...ts, { id, kind: t.kind ?? "info", title: t.title, description: t.description }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 end-4 z-[80] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-surface p-3 shadow-lg animate-slide-up"
              role="status"
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", TONE[t.kind])} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-ink">{t.title}</div>
                {t.description && <div className="text-xs text-ink-3">{t.description}</div>}
              </div>
              <button onClick={() => remove(t.id)} className="text-ink-3 hover:text-ink" aria-label={tr("actions.dismiss")}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
