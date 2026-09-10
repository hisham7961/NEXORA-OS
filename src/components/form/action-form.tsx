"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { useToast, useI18n } from "@/components/providers";
import { Button, Field } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Uniform result shape returned by every server action (mirrors src/lib/action.ts). */
export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

type FormAction = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

const FieldErrorContext = createContext<Record<string, string[]>>({});
export function useFieldError(name: string): string | undefined {
  return useContext(FieldErrorContext)[name]?.[0];
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {label}
    </Button>
  );
}

/**
 * Enterprise form wrapper (Phase 2, Part F): validation surfaced per-field and as
 * a banner, dirty-state unload guard, loading state, success/error toasts, and a
 * consistent submit/cancel footer. Works inside a Drawer or on a full page.
 */
export function ActionForm({
  action,
  onSuccess,
  onCancel,
  submitLabel,
  cancelLabel,
  children,
  className,
  dirtyGuard = true,
}: {
  action: FormAction;
  onSuccess?: (data: unknown) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  children: ReactNode;
  className?: string;
  dirtyGuard?: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  const { toast } = useToast();
  const { t } = useI18n();
  const [dirty, setDirty] = useState(false);
  const handled = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (!state || state === handled.current) return;
    handled.current = state;
    if (state.ok) {
      toast({ kind: "success", title: t("toast.saved") });
      setDirty(false);
      onSuccess?.(state.data);
    } else {
      toast({ kind: "error", title: state.error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (!dirtyGuard || !dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty, dirtyGuard]);

  const fieldErrors = state && !state.ok && state.fieldErrors ? state.fieldErrors : {};
  const showBanner = state && !state.ok && !state.fieldErrors;

  return (
    <FieldErrorContext.Provider value={fieldErrors}>
      <form action={formAction} onChange={() => setDirty(true)} className={cn("space-y-4", className)}>
        {children}
        {showBanner && (
          <div className="flex items-start gap-2 rounded-md border border-critical/30 bg-critical-soft px-3 py-2 text-[13px] text-critical">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-1">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {cancelLabel ?? t("actions.cancel")}
            </Button>
          )}
          <SubmitButton label={submitLabel ?? t("actions.saveChanges")} />
        </div>
      </form>
    </FieldErrorContext.Provider>
  );
}

/** A labelled form field that shows its server-side validation error automatically. */
export function FormField({
  label,
  name,
  hint,
  required,
  children,
  className,
}: {
  label: ReactNode;
  name: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const error = useFieldError(name);
  return (
    <Field
      className={className}
      label={required ? (<span>{label} <span className="text-critical">*</span></span>) : label}
      hint={hint}
      error={error}
    >
      {children}
    </Field>
  );
}

export function FormSection({ title, description, children, columns = 2 }: { title?: ReactNode; description?: ReactNode; children: ReactNode; columns?: 1 | 2 }) {
  return (
    <div>
      {title && (
        <div className="mb-2.5">
          <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
          {description && <p className="text-xs text-ink-3">{description}</p>}
        </div>
      )}
      <div className={cn("grid gap-3", columns === 2 ? "sm:grid-cols-2" : "grid-cols-1")}>{children}</div>
    </div>
  );
}
