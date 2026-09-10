"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Play, Download, Save, Plus, Trash2 } from "lucide-react";
import { Button, Input, Select, Badge } from "@/components/ui";
import { useToast } from "@/components/providers";
import { saveViewAction, deleteSavedViewAction } from "@/app/actions/personal";
import { toCsv } from "@/lib/csv";

type Field = { key: string; label: string; type: string; operators: string[]; options?: string[]; aggregatable?: boolean; sortable?: boolean };
type Source = { key: string; label: string; dateField?: string; fields: Field[] };
type Filter = { field: string; op: string; value: string };
type Config = { source: string; columns: string[]; filters: Filter[]; from?: string; to?: string; sort?: { field: string; dir: "asc" | "desc" }; groupBy?: string; aggregate?: { fn: "count" | "sum"; field?: string } };
type SavedReport = { id: string; name: string; module: string; filtersJson: string };
type RunResult =
  | { kind: "detail"; label: string; columns: { key: string; label: string }[]; rows: Record<string, unknown>[] }
  | { kind: "aggregate"; label: string; groupBy: string; aggregate: { fn: string; field?: string }; rows: { group: string; count: number; sum: number | null }[] };

export function ReportBuilder({ savedReports }: { savedReports: SavedReport[] }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [sources, setSources] = useState<Source[]>([]);
  const [saved, setSaved] = useState(savedReports);
  const [sourceKey, setSourceKey] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [groupBy, setGroupBy] = useState(""); const [aggFn, setAggFn] = useState<"count" | "sum">("count"); const [aggField, setAggField] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);

  useEffect(() => { fetch("/api/v1/report-builder/sources").then((r) => r.json()).then((j) => { setSources(j.data?.sources ?? []); if (j.data?.sources?.[0]) selectSource(j.data.sources[0].key, j.data.sources); }); }, []); // eslint-disable-line
  const source = useMemo(() => sources.find((s) => s.key === sourceKey), [sources, sourceKey]);

  function selectSource(key: string, list = sources) {
    setSourceKey(key); setResult(null); setGroupBy(""); setFilters([]);
    const s = list.find((x) => x.key === key);
    setColumns(s ? s.fields.slice(0, 4).map((f) => f.key) : []);
  }

  const config = (): Config => ({ source: sourceKey, columns, filters: filters.filter((f) => f.field && f.value), from: from || undefined, to: to || undefined, groupBy: groupBy || undefined, aggregate: groupBy ? { fn: aggFn, field: aggFn === "sum" ? aggField : undefined } : undefined });

  const run = () => start(async () => {
    const res = await fetch("/api/v1/report-builder/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(config()) });
    const j = await res.json();
    if (res.ok) setResult(j.data as RunResult); else toast({ kind: "error", title: j?.error?.message ?? "Run failed" });
  });
  const exportCsv = () => {
    if (!result) return;
    let headers: string[]; let rows: unknown[][];
    if (result.kind === "detail") { headers = result.columns.map((c) => c.label); rows = result.rows.map((r) => result.columns.map((c) => r[c.key])); }
    else { headers = [result.groupBy, "Count", result.aggregate.fn === "sum" ? `Sum(${result.aggregate.field})` : "Count"]; rows = result.rows.map((r) => [r.group, r.count, r.sum ?? r.count]); }
    const blob = new Blob([toCsv(headers, rows)], { type: "text/csv" }); const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `report-${sourceKey}.csv`; a.click();
  };
  const saveReport = () => start(async () => {
    const name = window.prompt("Name this report"); if (!name) return;
    const r = await saveViewAction({ module: `report:${sourceKey}`, name, filtersJson: JSON.stringify(config()), isShared: false });
    if (r.ok) { toast({ kind: "success", title: "Report saved" }); setSaved((s) => [...s, { id: (r as { data?: { id: string } }).data?.id ?? "", name, module: `report:${sourceKey}`, filtersJson: JSON.stringify(config()) }]); } else toast({ kind: "error", title: r.error });
  });
  const loadReport = (rep: SavedReport) => {
    try {
      const c = JSON.parse(rep.filtersJson) as Config;
      selectSource(c.source); setTimeout(() => { setColumns(c.columns ?? []); setFilters(c.filters ?? []); setFrom(c.from ?? ""); setTo(c.to ?? ""); setGroupBy(c.groupBy ?? ""); if (c.aggregate) { setAggFn(c.aggregate.fn); setAggField(c.aggregate.field ?? ""); } }, 0);
    } catch { toast({ kind: "error", title: "Could not load report" }); }
  };
  const removeReport = (id: string) => start(async () => { const r = await deleteSavedViewAction(id); if (r.ok) setSaved((s) => s.filter((x) => x.id !== id)); });

  if (!source) return <p className="text-[13px] text-ink-3">Loading report sources…</p>;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-3">
        <div className="rounded-lg border border-line p-3">
          <label className="block"><span className="mb-1 block text-[12px] text-ink-2">Data source</span><Select value={sourceKey} onChange={(e) => selectSource(e.target.value)}>{sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></label>
          <div className="mt-3">
            <div className="mb-1 text-[12px] text-ink-2">Columns</div>
            <div className="flex flex-wrap gap-1">
              {source.fields.map((f) => (
                <button key={f.key} onClick={() => setColumns((c) => c.includes(f.key) ? c.filter((x) => x !== f.key) : [...c, f.key])}
                  className={`rounded px-2 py-0.5 text-[11px] ${columns.includes(f.key) ? "bg-accent-soft text-ink" : "bg-surface-2 text-ink-3"}`}>{f.label}</button>
              ))}
            </div>
          </div>
          {source.dateField && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block"><span className="mb-1 block text-[11px] text-ink-3">From</span><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" /></label>
              <label className="block"><span className="mb-1 block text-[11px] text-ink-3">To</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" /></label>
            </div>
          )}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[12px] text-ink-2">Filters<button className="text-ink-3 hover:text-ink" onClick={() => setFilters((f) => [...f, { field: source.fields[0].key, op: source.fields[0].operators[0], value: "" }])}><Plus className="h-3.5 w-3.5" /></button></div>
            {filters.map((flt, i) => {
              const f = source.fields.find((x) => x.key === flt.field);
              return (
                <div key={i} className="mb-1 flex items-center gap-1">
                  <Select value={flt.field} onChange={(e) => { const nf = source.fields.find((x) => x.key === e.target.value)!; setFilters((fs) => fs.map((x, j) => j === i ? { field: nf.key, op: nf.operators[0], value: "" } : x)); }} className="h-7 flex-1 text-[11px]">{source.fields.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</Select>
                  <Select value={flt.op} onChange={(e) => setFilters((fs) => fs.map((x, j) => j === i ? { ...x, op: e.target.value } : x))} className="h-7 w-16 text-[11px]">{(f?.operators ?? []).map((o) => <option key={o} value={o}>{o}</option>)}</Select>
                  {f?.type === "enum" ? <Select value={flt.value} onChange={(e) => setFilters((fs) => fs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} className="h-7 w-20 text-[11px]"><option value="">—</option>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</Select>
                    : <Input value={flt.value} onChange={(e) => setFilters((fs) => fs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} className="h-7 w-20 text-[11px]" />}
                  <button className="text-ink-3 hover:text-critical" onClick={() => setFilters((fs) => fs.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></button>
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <div className="mb-1 text-[12px] text-ink-2">Group &amp; aggregate</div>
            <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="h-8"><option value="">No grouping</option>{source.fields.filter((f) => f.aggregatable).map((f) => <option key={f.key} value={f.key}>By {f.label}</option>)}</Select>
            {groupBy && <div className="mt-1 flex gap-1">
              <Select value={aggFn} onChange={(e) => setAggFn(e.target.value as "count" | "sum")} className="h-8 w-24"><option value="count">Count</option><option value="sum">Sum</option></Select>
              {aggFn === "sum" && <Select value={aggField} onChange={(e) => setAggField(e.target.value)} className="h-8 flex-1"><option value="">field…</option>{source.fields.filter((f) => f.type === "number").map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</Select>}
            </div>}
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" disabled={pending} onClick={run}><Play className="h-4 w-4" /> Run</Button>
            <Button variant="secondary" size="sm" disabled={!result} onClick={exportCsv}><Download className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={saveReport}><Save className="h-4 w-4" /></Button>
          </div>
        </div>
        {saved.length > 0 && (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-1 text-[12px] font-medium text-ink-2">Saved reports</div>
            {saved.map((rep) => (
              <div key={rep.id} className="group flex items-center justify-between gap-1 rounded px-1 py-1 hover:bg-surface-2">
                <button className="min-w-0 flex-1 truncate text-start text-[13px] text-ink-2" onClick={() => loadReport(rep)}>{rep.name}</button>
                <button className="text-ink-3 opacity-0 hover:text-critical group-hover:opacity-100" onClick={() => removeReport(rep.id)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-line">
        {!result ? <div className="p-8 text-center text-[13px] text-ink-3">Configure a report and press Run. Reports enforce your permissions and scope.</div>
          : result.kind === "aggregate" ? (
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-line text-ink-3"><th className="px-3 py-2 text-start font-medium">{result.groupBy}</th><th className="px-3 py-2 text-end font-medium">Count</th>{result.aggregate.fn === "sum" && <th className="px-3 py-2 text-end font-medium">Sum({result.aggregate.field})</th>}</tr></thead>
              <tbody>{result.rows.map((r, i) => <tr key={i} className="border-b border-line last:border-0"><td className="px-3 py-1.5 text-ink">{r.group}</td><td className="px-3 py-1.5 text-end tabular text-ink-2">{r.count}</td>{result.aggregate.fn === "sum" && <td className="px-3 py-1.5 text-end tabular text-ink">{r.sum?.toLocaleString()}</td>}</tr>)}</tbody>
            </table>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex items-center justify-between px-3 py-2"><Badge category="info">{result.rows.length} rows</Badge></div>
              <table className="w-full text-[13px]">
                <thead><tr className="border-y border-line text-ink-3">{result.columns.map((c) => <th key={c.key} className="px-3 py-2 text-start font-medium">{c.label}</th>)}</tr></thead>
                <tbody>{result.rows.map((r, i) => <tr key={i} className="border-b border-line last:border-0">{result.columns.map((c) => <td key={c.key} className="px-3 py-1.5 text-ink-2">{String(r[c.key] ?? "")}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
