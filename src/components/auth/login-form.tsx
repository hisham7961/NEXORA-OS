"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LogIn } from "lucide-react";
import { signInAction, type AuthState } from "@/app/actions/auth";
import { useI18n } from "@/components/providers";
import { Field, Input } from "@/components/ui";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[14px] font-medium text-on-accent shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-60"
    >
      {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <LogIn className="h-4 w-4" />}
      {label}
    </button>
  );
}

export function LoginForm({ demoAccounts }: { demoAccounts: { label: string; email: string }[] }) {
  const { t } = useI18n();
  const [state, formAction] = useActionState<AuthState, FormData>(signInAction, {});

  return (
    <div className="w-full">
      <form action={formAction} className="space-y-4">
        <Field label={t("auth.email")} htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={demoAccounts[0]?.email} placeholder="you@company.com" /* i18n-ignore email example */ />
        </Field>
        <Field label={t("auth.password")} htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" defaultValue={demoAccounts.length ? "password" : undefined} />
        </Field>

        {state.mfaRequired && (
          <Field label={t("auth.mfaCode")} htmlFor="code">
            <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123 456" />
          </Field>
        )}

        {state.mfaRequired && !state.error?.startsWith("mfa_invalid") ? (
          <div className="rounded-md border border-line bg-surface-2/50 px-3 py-2 text-[13px] text-ink-2">
            {t("auth.mfaPrompt")}
          </div>
        ) : state.error && (
          <div className="rounded-md border border-critical/30 bg-critical-soft px-3 py-2 text-[13px] text-critical">
            {state.error === "rate_limited" ? t("auth.tooMany") : state.error.startsWith("mfa") ? t("auth.mfaInvalid") : t("auth.invalid")}
          </div>
        )}

        <SubmitButton label={t("auth.signIn")} />
      </form>

      {demoAccounts.length > 0 && (
        <div className="mt-6 rounded-lg border border-line bg-surface-2/50 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("auth.demoHint")}</div>
          <div className="space-y-1">
            {demoAccounts.map((a) => (
              <div key={a.email} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-ink-2">{a.label}</span>
                <code className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-ink-3">{a.email}</code>
              </div>
            ))}
            <div className="pt-1 text-[11px] text-ink-3">{t("auth.demoPassword")} <code className="text-ink-2">password</code></div>
          </div>
        </div>
      )}
    </div>
  );
}
