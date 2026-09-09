"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Copy, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { RequestAnswerButton } from "@/components/answers/answer-controls";
import { recordAnswerUsageAction } from "@/app/actions/answers";
import type { Option } from "@/domain/options";

interface FoundAnswer {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  language: string;
  version: number;
}

/**
 * Customer Case integration (§17): find an approved answer without leaving the
 * case, copy the exact approved text (recording usage against the case), or
 * request a new answer if none fits.
 */
export function FindAnswer({ caseId, brandId, countryId, options }: { caseId: string; brandId: string | null; countryId: string | null; options: { brands: Option[]; countries: Option[] } }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoundAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (brandId) p.set("brandId", brandId);
    if (countryId) p.set("countryId", countryId);
    try {
      const r = await fetch(`/api/v1/answers/find?${p.toString()}`);
      if (r.ok) { const j = await r.json(); setResults(j.data ?? []); }
    } finally { setLoading(false); }
  }, [brandId, countryId]);

  useEffect(() => { search(""); }, [search]);

  const copy = async (a: FoundAnswer) => {
    try { await navigator.clipboard.writeText(a.answer); } catch { /* ignore */ }
    setCopiedId(a.id);
    recordAnswerUsageAction(a.id, caseId).catch(() => {});
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); search(q); }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search approved answers…" className="ps-8" />
        </div>
        <Button type="submit" variant="secondary" size="sm" disabled={loading}>Search</Button>
      </form>

      {results.length === 0 ? (
        <div className="rounded-md border border-dashed border-line p-4 text-center">
          <p className="text-[13px] text-ink-3">{loading ? "Searching…" : "No approved answer found."}</p>
          <div className="mt-2 flex justify-center">
            <RequestAnswerButton options={options} variant="secondary" />
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {results.map((a) => (
            <li key={a.id} className="rounded-md border border-line bg-surface-2/40 p-2.5">
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="text-[12.5px] font-medium text-ink">{a.question}</span>
                <span className="shrink-0 text-[10px] uppercase text-ink-3">{a.language} · v{a.version}</span>
              </div>
              <p className="mb-2 whitespace-pre-wrap text-[12.5px] text-ink-2 line-clamp-4">{a.answer}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => copy(a)}>{copiedId === a.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiedId === a.id ? "Copied" : "Copy"}</Button>
                <Link href={`/answers/${a.id}`} className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"><ExternalLink className="h-3 w-3" /> Open</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
