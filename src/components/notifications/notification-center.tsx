"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Archive, CheckCheck, SlidersHorizontal, Circle } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { markReadAction, archiveNotificationsAction, markAllReadAction, setPreferenceAction } from "@/app/actions/notifications";

export interface NotifGroup {
  key: string;
  title: string;
  body: string | null;
  createdAt: string;
  count: number;
  ids: string[];
  href: string | null;
  category: string;
  unread: boolean;
}

function timeAgo(iso: string, justNow: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return justNow;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function NotificationCenter({
  groups,
  unread,
  categories,
  preferences,
  activeCategory,
  onlyUnread,
}: {
  groups: NotifGroup[];
  unread: number;
  categories: string[];
  preferences: Record<string, { inapp: boolean; email: boolean }>;
  activeCategory?: string;
  onlyUnread: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [showPrefs, setShowPrefs] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { const r = await fn(); if (r.ok) router.refresh(); else toast({ kind: "error", title: r.error ?? t("notif.failed") }); });

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(window.location.search);
    if (v) p.set(k, v); else p.delete(k);
    router.push(`/notifications${p.toString() ? `?${p}` : ""}`);
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-line p-0.5">
          <button onClick={() => setParam("unread", null)} className={`rounded px-2.5 py-1 text-[12px] ${!onlyUnread ? "bg-accent-soft text-accent" : "text-ink-2"}`}>{t("notif.all")}</button>
          <button onClick={() => setParam("unread", "1")} className={`rounded px-2.5 py-1 text-[12px] ${onlyUnread ? "bg-accent-soft text-accent" : "text-ink-2"}`}>{t("notif.unread")} {unread > 0 && `(${unread})`}</button>
        </div>
        <select value={activeCategory ?? ""} onChange={(e) => setParam("category", e.target.value || null)} className="h-8 rounded-md border border-line bg-surface px-2 text-[12px] text-ink-2">
          <option value="">{t("notif.allCategories")}</option>
          {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
        </select>
        <div className="ms-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowPrefs((v) => !v)}><SlidersHorizontal className="h-3.5 w-3.5" /> {t("notif.preferences")}</Button>
          <Button variant="secondary" size="sm" disabled={pending || unread === 0} onClick={() => run(() => markAllReadAction())}><CheckCheck className="h-3.5 w-3.5" /> {t("notif.markAllRead")}</Button>
        </div>
      </div>

      {showPrefs && (
        <div className="mb-4 rounded-lg border border-line bg-surface-2/40 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("notif.prefsTitle")}</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
            {categories.map((c) => (
              <label key={c} className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <input type="checkbox" defaultChecked={preferences[c]?.inapp ?? true} disabled={pending} className="accent-[var(--accent)]"
                  onChange={(e) => run(() => setPreferenceAction(c, "inapp", e.target.checked))} />
                <span className="capitalize">{c.replace(/_/g, " ")}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-lg border border-line py-12 text-center">
          <p className="text-[13px] font-medium text-ink">{t("notif.caughtUp")}</p>
          <p className="mt-1 text-xs text-ink-3">{t("notif.caughtUpBody")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {groups.map((g) => {
            const Body = (
              <div className="flex items-start gap-3 px-4 py-3">
                {g.unread ? <Circle className="mt-1 h-2 w-2 shrink-0 fill-accent text-accent" /> : <span className="mt-1 h-2 w-2 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] ${g.unread ? "font-semibold text-ink" : "text-ink-2"}`}>{g.title}</span>
                    {g.count > 1 && <span className="rounded-full bg-surface-2 px-1.5 text-[10px] text-ink-3">×{g.count}</span>}
                  </div>
                  {g.body && <div className="truncate text-xs text-ink-3">{g.body}</div>}
                </div>
                <span className="whitespace-nowrap text-[11px] text-ink-3">{timeAgo(g.createdAt, t("notif.justNow"))}</span>
              </div>
            );
            return (
              <li key={g.key} className={`group relative ${g.unread ? "bg-accent-soft/20" : ""}`}>
                <div className="flex items-center">
                  <div className="min-w-0 flex-1">{g.href ? <Link href={g.href} onClick={() => run(() => markReadAction(g.ids, true))}>{Body}</Link> : Body}</div>
                  <div className="flex shrink-0 items-center gap-1 pe-3 opacity-0 group-hover:opacity-100">
                    {g.unread && <button title={t("notif.markRead")} disabled={pending} onClick={() => run(() => markReadAction(g.ids, true))} className="p-1.5 text-ink-3 hover:text-accent"><Check className="h-3.5 w-3.5" /></button>}
                    <button title={t("notif.archive")} disabled={pending} onClick={() => run(() => archiveNotificationsAction(g.ids))} className="p-1.5 text-ink-3 hover:text-critical"><Archive className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
