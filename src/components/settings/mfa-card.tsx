"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldAlert, Copy, Check, KeyRound } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { useToast } from "@/components/providers";
import { beginMfaEnrollmentAction, confirmMfaEnrollmentAction, disableMfaAction } from "@/app/actions/mfa";

export interface MfaStatusView { enabled: boolean; enrolledAt: string | null; recoveryRemaining: number }

/**
 * Two-factor authentication card (§26-27). Enroll with an authenticator app by
 * entering the shown secret (or pasting the otpauth URI), confirm a code, then save
 * the one-time recovery codes. Disabling requires a current code. Dependency-free:
 * the secret is offered for manual entry rather than a bundled QR renderer.
 */
export function MfaCard({ status, required }: { status: MfaStatusView; required: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, tag: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(tag); setTimeout(() => setCopied(null), 1500); } catch { /* on-screen fallback */ }
  };

  const begin = () => start(async () => {
    const r = await beginMfaEnrollmentAction();
    if (r.ok && r.data) { setSetup(r.data); setCode(""); } else toast({ kind: "error", title: r.ok ? "Failed" : r.error });
  });
  const confirm = () => start(async () => {
    const r = await confirmMfaEnrollmentAction(code.trim());
    if (r.ok && r.data) { setRecovery(r.data.recoveryCodes); setSetup(null); setCode(""); router.refresh(); }
    else toast({ kind: "error", title: r.ok ? "Failed" : r.error });
  });
  const disable = () => start(async () => {
    const r = await disableMfaAction(code.trim());
    if (r.ok) { toast({ kind: "success", title: "MFA disabled" }); setDisabling(false); setCode(""); router.refresh(); }
    else toast({ kind: "error", title: r.error });
  });

  // Freshly generated recovery codes — show once.
  if (recovery) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-success"><ShieldCheck className="h-4 w-4" /> Two-factor authentication is on.</div>
        <div className="rounded-lg border border-accent bg-accent-soft/40 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-accent"><KeyRound className="h-3.5 w-3.5" /> Recovery codes — store these now, each works once and they won’t be shown again</div>
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[13px] text-ink">
            {recovery.map((c) => <code key={c} className="rounded bg-surface px-2 py-1">{c}</code>)}
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => copy(recovery.join("\n"), "rec")}>{copied === "rec" ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy all</>}</Button>
            <Button size="sm" variant="ghost" onClick={() => setRecovery(null)}>Done</Button>
          </div>
        </div>
      </div>
    );
  }

  if (status.enabled) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-success"><ShieldCheck className="h-4 w-4" /> Two-factor authentication is on{status.enrolledAt ? ` since ${new Date(status.enrolledAt).toLocaleDateString()}` : ""}.</div>
        <p className="text-[12px] text-ink-3">{status.recoveryRemaining} recovery code{status.recoveryRemaining === 1 ? "" : "s"} remaining. You’ll be asked for a code from your authenticator app at every sign-in.</p>
        {!disabling ? (
          <Button size="sm" variant="ghost" onClick={() => setDisabling(true)}>Disable two-factor…</Button>
        ) : (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
            <div>
              <Label htmlFor="mfa-off-code">Enter a current code or a recovery code to disable</Label>
              <Input id="mfa-off-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" className="w-40" />
            </div>
            <Button size="sm" variant="primary" disabled={pending || !code.trim()} onClick={disable}>Disable</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDisabling(false); setCode(""); }}>Cancel</Button>
          </div>
        )}
      </div>
    );
  }

  // Not enabled.
  return (
    <div className="space-y-3">
      {required && (
        <div className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-[12.5px] text-warning">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> Your role requires two-factor authentication. Please set it up now.
        </div>
      )}
      {!setup ? (
        <>
          <p className="text-[13px] text-ink-2">Add a second step at sign-in using an authenticator app (Google Authenticator, Authy, 1Password…).</p>
          <Button size="sm" variant="primary" disabled={pending} onClick={begin}><ShieldCheck className="h-3.5 w-3.5" /> Enable two-factor</Button>
        </>
      ) : (
        <div className="space-y-3 rounded-lg border border-line p-3">
          <div>
            <div className="mb-1 text-[12px] font-semibold text-ink">1 · Add this key to your authenticator app</div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1.5 font-mono text-[13px] tracking-wider text-ink">{setup.secret}</code>
              <Button size="sm" variant="secondary" onClick={() => copy(setup.secret, "sec")}>{copied === "sec" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</Button>
            </div>
            <button type="button" className="mt-1 text-[11px] text-accent hover:underline" onClick={() => copy(setup.otpauthUri, "uri")}>{copied === "uri" ? "Copied setup link" : "Or copy the otpauth:// setup link"}</button>
          </div>
          <div>
            <Label htmlFor="mfa-code">2 · Enter the 6-digit code it shows</Label>
            <div className="flex items-center gap-2">
              <Input id="mfa-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" className="w-40" inputMode="numeric" autoComplete="one-time-code" />
              <Button size="sm" variant="primary" disabled={pending || code.trim().length < 6} onClick={confirm}>Verify &amp; enable</Button>
              <Button size="sm" variant="ghost" onClick={() => { setSetup(null); setCode(""); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
