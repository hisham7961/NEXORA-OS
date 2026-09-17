"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Monitor, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { revokeSessionAction, revokeOtherSessionsAction } from "@/app/actions/sessions";

export interface SessionRow {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  current: boolean;
}

/** Short, human label for a session's device from its user-agent string. */
function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return [browser, os].filter(Boolean).join(" · ") || "Browser";
}

/**
 * Active-session manager (§28-29): shows every device signed in as the caller and
 * lets them revoke any of them or all others at once. Revocation cuts access on the
 * next request — the core "sign out a device I don't recognize" control.
 */
export function SessionManager({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const hasOthers = sessions.some((s) => !s.current);

  const revoke = (id: string, current: boolean) => {
    if (current && !confirm(t("ss.signOutCurrentConfirm"))) return;
    if (!current && !confirm(t("ss.signOutDeviceConfirm"))) return;
    setBusyId(id);
    start(async () => {
      const r = await revokeSessionAction(id);
      setBusyId(null);
      if (r.ok) { toast({ kind: "success", title: t("ss.sessionRevoked") }); if (current) router.push("/login"); else router.refresh(); }
      else toast({ kind: "error", title: r.error });
    });
  };

  const revokeOthers = () => {
    if (!confirm(t("ss.signOutOthersConfirm"))) return;
    start(async () => {
      const r = await revokeOtherSessionsAction();
      if (r.ok) { toast({ kind: "success", title: t("ss.signedOutN", { count: r.data?.revoked ?? 0 }) }); router.refresh(); }
      else toast({ kind: "error", title: r.error });
    });
  };

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line rounded-lg border border-line">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Monitor className="h-4 w-4 shrink-0 text-ink-3" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] text-ink">
                  <span className="truncate font-medium">{deviceLabel(s.userAgent)}</span>
                  {s.current && <span className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent"><ShieldCheck className="h-3 w-3" /> {t("ss.thisDevice")}</span>}
                </div>
                <div className="text-[11px] text-ink-3">{s.ip ?? t("ss.unknownIp")} · {s.lastActiveAt ? t("ss.activeAt", { date: new Date(s.lastActiveAt).toLocaleString() }) : t("ss.signedInAt", { date: new Date(s.createdAt).toLocaleDateString() })}</div>
              </div>
            </div>
            <Button size="sm" variant="ghost" disabled={pending && busyId === s.id} onClick={() => revoke(s.id, s.current)}><LogOut className="h-3.5 w-3.5" /> {s.current ? t("ss.signOut") : t("ss.revoke")}</Button>
          </li>
        ))}
      </ul>
      {hasOthers && (
        <Button variant="secondary" size="sm" disabled={pending} onClick={revokeOthers}><LogOut className="h-3.5 w-3.5" /> {t("ss.signOutAllOthers")}</Button>
      )}
    </div>
  );
}
