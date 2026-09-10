"use client";

import { useState, useTransition } from "react";
import { Check, Lock } from "lucide-react";
import { Input, Select, Button, Badge } from "@/components/ui";
import { useToast } from "@/components/providers";
import { updateSettingAction } from "@/app/actions/settings";

type Setting = {
  key: string; category: string; label: string; description: string; type: string;
  value: string | number | boolean | null; options?: { value: string; label: string }[];
  min?: number; max?: number; restartRequired?: boolean; secretConfigured?: boolean; canEdit: boolean;
};

function SettingRow({ s, canManage }: { s: Setting; canManage: boolean }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [val, setVal] = useState(s.value);
  const [dirty, setDirty] = useState(false);

  const save = (next: string | number | boolean) => start(async () => {
    const r = await updateSettingAction(s.key, next);
    if (r.ok) { toast({ kind: "success", title: "Saved" }); setDirty(false); } else { toast({ kind: "error", title: r.error }); }
  });

  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13px] font-medium text-ink">{s.label}
          {s.restartRequired && <Badge category="warning">restart</Badge>}
          {s.type === "secret" && <Badge category={s.secretConfigured ? "success" : "neutral"}>{s.secretConfigured ? "configured" : "not set"}</Badge>}
        </div>
        <p className="mt-0.5 text-[12px] text-ink-3">{s.description}</p>
        <code className="text-[10px] text-ink-3">{s.key}</code>
      </div>
      <div className="flex w-[240px] shrink-0 items-center gap-2">
        {s.type === "secret" ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-ink-3"><Lock className="h-3.5 w-3.5" /> environment-managed</span>
        ) : s.type === "boolean" ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px]">
            <input type="checkbox" checked={val === true} disabled={!canManage || pending} onChange={(e) => { setVal(e.target.checked); save(e.target.checked); }} className="h-4 w-4" />
            <span className="text-ink-2">{val === true ? "On" : "Off"}</span>
          </label>
        ) : s.type === "enum" ? (
          <Select value={String(val ?? "")} disabled={!canManage || pending} onChange={(e) => { setVal(e.target.value); save(e.target.value); }} className="h-8">
            {s.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        ) : (
          <>
            <Input type={s.type === "number" ? "number" : "text"} value={String(val ?? "")} disabled={!canManage || pending}
              onChange={(e) => { setVal(s.type === "number" ? e.target.value : e.target.value); setDirty(true); }}
              className="h-8" min={s.min} max={s.max} />
            {dirty && canManage && <Button variant="primary" size="sm" disabled={pending} onClick={() => save(s.type === "number" ? Number(val) : String(val))}><Check className="h-3.5 w-3.5" /></Button>}
          </>
        )}
      </div>
    </div>
  );
}

export function SettingsEditor({ settings, canManage }: { settings: Setting[]; canManage: boolean }) {
  const categories = [...new Set(settings.map((s) => s.category))];
  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat} className="rounded-xl border border-line bg-surface">
          <div className="border-b border-line px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-ink-2">{cat}</div>
          {settings.filter((s) => s.category === cat).map((s) => <SettingRow key={s.key} s={s} canManage={canManage} />)}
        </div>
      ))}
    </div>
  );
}
