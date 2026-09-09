"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";
import { Select } from "@/components/ui";

/** Legal-company selector for accounting pages — sets ?company= and reloads. */
export function CompanyPicker({ companies, current }: { companies: { id: string; name: string; baseCurrency: string }[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (companies.length <= 1) {
    const c = companies[0];
    return c ? <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2"><Building2 className="h-4 w-4 text-ink-3" /> {c.name} · {c.baseCurrency}</span> : null;
  }
  return (
    <div className="inline-flex items-center gap-1.5">
      <Building2 className="h-4 w-4 text-ink-3" />
      <Select value={current} className="h-8 w-auto min-w-[180px]" onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set("company", e.target.value);
        router.push(`${pathname}?${next.toString()}`);
      }}>
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.baseCurrency}</option>)}
      </Select>
    </div>
  );
}
