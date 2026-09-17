"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Copy, Check, Trash2, Plus } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { createApiTokenAction, revokeApiTokenAction } from "@/app/actions/api-tokens";

export interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  readOnly: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  status: "active" | "revoked" | "expired";
}

/**
 * Personal API token manager (§32). Create tokens (optionally read-only or with an
 * expiry), see the raw value exactly once, and revoke. Tokens act as the caller with
 * their permissions; the raw secret is never retrievable after creation.
 */
export function ApiTokenManager({ tokens }: { tokens: TokenRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("");
  const [fresh, setFresh] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const create = () => {
    if (!name.trim()) return;
    start(async () => {
      const days = expiresInDays.trim() ? Number(expiresInDays) : undefined;
      const r = await createApiTokenAction({ name: name.trim(), readOnly, expiresInDays: days && days > 0 ? days : undefined });
      if (r.ok && r.data) { setFresh({ name: r.data.name, token: r.data.token }); setName(""); setReadOnly(false); setExpiresInDays(""); router.refresh(); }
      else toast({ kind: "error", title: r.ok ? t("sec.noTokenReturned") : r.error });
    });
  };

  const revoke = (id: string, tname: string) => {
    if (!confirm(t("sec.revokeTokenConfirm", { name: tname }))) return;
    start(async () => {
      const r = await revokeApiTokenAction(id);
      if (r.ok) { toast({ kind: "success", title: t("sec.tokenRevoked") }); router.refresh(); }
      else toast({ kind: "error", title: r.error });
    });
  };

  const copy = async () => {
    if (!fresh) return;
    try { await navigator.clipboard.writeText(fresh.token); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard blocked — the value is on screen to copy manually */ }
  };

  return (
    <div className="space-y-3">
      {fresh && (
        <div className="rounded-lg border border-accent bg-accent-soft/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-accent"><KeyRound className="h-3.5 w-3.5" /> {t("sec.newTokenName", { name: fresh.name })}</div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1.5 font-mono text-[12px] text-ink">{fresh.token}</code>
            <Button size="sm" variant="secondary" onClick={copy}>{copied ? <><Check className="h-3.5 w-3.5" /> {t("sec.copied")}</> : <><Copy className="h-3.5 w-3.5" /> {t("sec.copy")}</>}</Button>
            <Button size="sm" variant="ghost" onClick={() => setFresh(null)}>{t("sec.done")}</Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-line p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div>
            <Label htmlFor="tok-name">{t("sec.tokenName")}</Label>
            <Input id="tok-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("at.apiTokenPh")} />
          </div>
          <div>
            <Label htmlFor="tok-exp">{t("sec.expiresDays")}</Label>
            <Input id="tok-exp" type="number" min={1} max={365} value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} placeholder={t("sec.never")} className="w-28" />
          </div>
          <label className="flex items-center gap-1.5 pb-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} /> {t("sec.readOnly")}
          </label>
          <Button variant="primary" disabled={pending || !name.trim()} onClick={create}><Plus className="h-3.5 w-3.5" /> {t("common.create")}</Button>
        </div>
      </div>

      <ul className="divide-y divide-line rounded-lg border border-line">
        {tokens.length === 0 ? (
          <li className="px-3 py-6 text-center text-[13px] text-ink-3">{t("sec.noTokens")}</li>
        ) : tokens.map((tok) => (
          <li key={tok.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] text-ink">
                <span className="truncate font-medium">{tok.name}</span>
                {tok.readOnly && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-2">{t("sec.readOnlyBadge")}</span>}
                {tok.status !== "active" && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-critical">{t(`status.${tok.status}`)}</span>}
              </div>
              <div className="font-mono text-[11px] text-ink-3">{tok.prefix}… · {tok.lastUsedAt ? t("sec.lastUsed", { date: new Date(tok.lastUsedAt).toLocaleDateString() }) : t("sec.neverUsed")}{tok.expiresAt ? ` · ${t("sec.expiresOn", { date: new Date(tok.expiresAt).toLocaleDateString() })}` : ""}</div>
            </div>
            {tok.status === "active" && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => revoke(tok.id, tok.name)}><Trash2 className="h-3.5 w-3.5" /> {t("sec.revoke")}</Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
