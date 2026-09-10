"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Webhook, Copy, Check, Trash2, Plus, Power } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { useToast } from "@/components/providers";
import { createWebhookAction, setWebhookActiveAction, deleteWebhookAction } from "@/app/actions/webhooks";

export interface WebhookRow { id: string; name: string; url: string; events: string[]; active: boolean; createdAt: string }

/**
 * Outbound webhook manager (§36). Subscribe a URL to event types (comma-separated,
 * or * for all), see the signing secret once, toggle active, and delete. Each
 * delivery is HMAC-signed with the secret via X-Nexora-Signature.
 */
export function WebhookManager({ webhooks, knownEvents }: { webhooks: WebhookRow[]; knownEvents: string[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("*");
  const [fresh, setFresh] = useState<{ name: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const create = () => {
    if (!name.trim() || !url.trim()) return;
    const evts = events.split(",").map((e) => e.trim()).filter(Boolean);
    if (evts.length === 0) { toast({ kind: "error", title: "Add at least one event (or *)" }); return; }
    start(async () => {
      const r = await createWebhookAction({ name: name.trim(), url: url.trim(), events: evts });
      if (r.ok && r.data) { setFresh({ name: name.trim(), secret: r.data.secret }); setName(""); setUrl(""); setEvents("*"); router.refresh(); }
      else toast({ kind: "error", title: r.ok ? "Failed" : r.error });
    });
  };
  const toggle = (id: string, active: boolean) => start(async () => {
    const r = await setWebhookActiveAction(id, active); if (r.ok) router.refresh(); else toast({ kind: "error", title: r.error });
  });
  const remove = (id: string, nm: string) => {
    if (!confirm(`Delete webhook "${nm}"? Deliveries stop immediately.`)) return;
    start(async () => { const r = await deleteWebhookAction(id); if (r.ok) { toast({ kind: "success", title: "Webhook deleted" }); router.refresh(); } else toast({ kind: "error", title: r.error }); });
  };
  const copy = async () => { if (!fresh) return; try { await navigator.clipboard.writeText(fresh.secret); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* on screen */ } };

  return (
    <div className="space-y-3">
      {fresh && (
        <div className="rounded-lg border border-accent bg-accent-soft/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-accent"><Webhook className="h-3.5 w-3.5" /> Signing secret for “{fresh.name}” — copy it now, it won’t be shown again</div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1.5 font-mono text-[12px] text-ink">{fresh.secret}</code>
            <Button size="sm" variant="secondary" onClick={copy}>{copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}</Button>
            <Button size="sm" variant="ghost" onClick={() => setFresh(null)}>Done</Button>
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Verify deliveries: <code>HMAC-SHA256(secret, body)</code> equals the <code>X-Nexora-Signature</code> header (sha256=…).</p>
        </div>
      )}

      <div className="rounded-lg border border-line p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div><Label htmlFor="wh-name">Name</Label><Input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ops Slack relay" /></div>
          <div><Label htmlFor="wh-url">Payload URL</Label><Input id="wh-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/hooks/nexora" /></div>
          <div className="sm:col-span-2">
            <Label htmlFor="wh-events">Events (comma-separated, or *)</Label>
            <Input id="wh-events" value={events} onChange={(e) => setEvents(e.target.value)} placeholder="*  or  invoice.posted, campaign.updated" list="wh-known-events" />
            <datalist id="wh-known-events">{knownEvents.map((e) => <option key={e} value={e} />)}</datalist>
          </div>
        </div>
        <div className="mt-2"><Button variant="primary" size="sm" disabled={pending || !name.trim() || !url.trim()} onClick={create}><Plus className="h-3.5 w-3.5" /> Add webhook</Button></div>
      </div>

      <ul className="divide-y divide-line rounded-lg border border-line">
        {webhooks.length === 0 ? (
          <li className="px-3 py-6 text-center text-[13px] text-ink-3">No webhooks yet. Add one to receive signed event deliveries.</li>
        ) : webhooks.map((w) => (
          <li key={w.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] text-ink">
                <span className="truncate font-medium">{w.name}</span>
                {!w.active && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-3">disabled</span>}
              </div>
              <div className="truncate font-mono text-[11px] text-ink-3">{w.url}</div>
              <div className="text-[11px] text-ink-3">events: {w.events.join(", ")}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => toggle(w.id, !w.active)}><Power className="h-3.5 w-3.5" /> {w.active ? "Disable" : "Enable"}</Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(w.id, w.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
