"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Input, Select, Button, Badge } from "@/components/ui";
import { useToast } from "@/components/providers";
import { commitImportAction } from "@/app/actions/import";
import { toCsv } from "@/lib/csv";

type Column = { key: string; label: string; required?: boolean };
type Resource = { key: string; label: string; needsCompany: boolean; columns: Column[] };
type Company = { id: string; name: string };
type PreviewRow = { index: number; data: Record<string, unknown> | null; issues: string[]; duplicate: boolean };
type Preview = { rows: PreviewRow[]; summary: { total: number; importable: number; duplicates: number; invalid: number } };

function headerList(csv: string): string[] {
  return (csv.split(/\r?\n/)[0] ?? "").split(",").map((h) => h.trim().replace(/^"|"$/g, "")).filter(Boolean);
}

export function ImportWizard({ resources, companies }: { resources: Resource[]; companies: Company[] }) {
  const router = useRouter(); const { toast } = useToast();
  const [pending, start] = useTransition();
  const [resourceKey, setResourceKey] = useState(resources[0]?.key ?? "");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [csvText, setCsvText] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; errorCount: number; errors: { index: number; issue: string }[] } | null>(null);

  const resource = resources.find((r) => r.key === resourceKey)!;
  const headers = headerList(csvText);

  const onFile = (f: File | null) => { if (!f) return; f.text().then((t) => { setCsvText(t); setPreview(null); setResult(null); autoMap(t); }); };
  const autoMap = (csv: string) => {
    const hs = headerList(csv); const m: Record<string, string> = {};
    for (const c of resource.columns) { const hit = hs.find((h) => h.toLowerCase().replace(/[^a-z]/g, "") === c.key.toLowerCase().replace(/[^a-z]/g, "")); if (hit) m[c.key] = hit; }
    setMapping(m);
  };

  const doPreview = () => start(async () => {
    const res = await fetch(`/api/v1/import/${resourceKey}/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ companyId: resource.needsCompany ? companyId : undefined, csvText, mapping }) });
    const j = await res.json();
    if (res.ok) setPreview(j.data as Preview); else toast({ kind: "error", title: j?.error?.message ?? "Preview failed" });
  });
  const doCommit = () => start(async () => {
    const r = await commitImportAction(resourceKey, resource.needsCompany ? companyId : null, csvText, mapping);
    if (r.ok && r.data) { setResult(r.data); toast({ kind: "success", title: `Imported ${r.data.created}, skipped ${r.data.skipped}` }); router.refresh(); } else if (!r.ok) toast({ kind: "error", title: r.error });
  });
  const downloadErrors = () => {
    if (!result?.errors.length) return;
    const csv = toCsv(["Row", "Issue"], result.errors.map((e) => [e.index, e.issue]));
    const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `import-errors.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block"><span className="mb-1 block text-[12px] text-ink-2">What to import</span><Select value={resourceKey} onChange={(e) => { setResourceKey(e.target.value); setPreview(null); setResult(null); setMapping({}); }}>{resources.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</Select></label>
        {resource.needsCompany && <label className="block"><span className="mb-1 block text-[12px] text-ink-2">Company</span><Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></label>}
        <label className="block"><span className="mb-1 block text-[12px] text-ink-2">CSV file</span><input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} className="block w-full text-[13px] text-ink-2 file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-ink" /></label>
      </div>

      {headers.length > 0 && (
        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 text-[12px] font-medium text-ink-2">Map columns</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {resource.columns.map((c) => (
              <label key={c.key} className="block"><span className="mb-1 block text-[12px] text-ink-2">{c.label}{c.required ? " *" : ""}</span>
                <Select value={mapping[c.key] ?? ""} onChange={(e) => { setMapping({ ...mapping, [c.key]: e.target.value }); setPreview(null); }} className="h-8"><option value="">— none —</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</Select>
              </label>
            ))}
          </div>
        </div>
      )}

      {preview && (
        <div className="rounded-lg border border-line">
          <div className="flex flex-wrap gap-3 border-b border-line px-3 py-2 text-[12px]">
            <Badge category="info">{preview.summary.importable} importable</Badge>
            {preview.summary.duplicates > 0 && <Badge category="warning">{preview.summary.duplicates} duplicate</Badge>}
            {preview.summary.invalid > 0 && <Badge category="critical">{preview.summary.invalid} invalid</Badge>}
            <span className="text-ink-3">{preview.summary.total} rows</span>
          </div>
          <div className="max-h-52 overflow-y-auto text-[12px]">
            {preview.rows.slice(0, 40).map((r) => (
              <div key={r.index} className={`flex items-center justify-between gap-2 border-b border-line px-3 py-1 last:border-0 ${r.issues.length ? "text-critical" : r.duplicate ? "text-ink-3 line-through" : "text-ink-2"}`}>
                <span className="truncate">{r.data ? String(r.data.name ?? Object.values(r.data)[0] ?? "") : "—"}</span>
                <span>{r.issues.length ? r.issues.join(", ") : r.duplicate ? "duplicate" : "ok"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-line px-3 py-2 text-[13px]">
          <span className="text-success">{result.created} created</span> · <span className="text-ink-3">{result.skipped} skipped</span>{result.errorCount > 0 && <> · <span className="text-critical">{result.errorCount} errors</span> <button className="text-accent hover:underline" onClick={downloadErrors}>download errors</button></>}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button variant="secondary" size="sm" disabled={pending || !csvText} onClick={doPreview}><Upload className="h-4 w-4" /> Preview</Button>
        <Button variant="primary" size="sm" disabled={pending || !preview || preview.summary.importable === 0} onClick={doCommit}>Import {preview?.summary.importable ?? ""}</Button>
      </div>
    </div>
  );
}
