"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Select } from "@/components/ui";
import { useI18n } from "@/components/providers";
import { SavedViews } from "@/components/personal/bookmarks";

export interface ToolbarFilter {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * URL-driven list toolbar (§45, §77): search + filters live in the query string
 * so views are shareable/bookmarkable and the server renders the filtered result.
 */
export function ListToolbar({
  placeholder,
  filters = [],
  savedViewsModule,
  children,
}: {
  placeholder?: string;
  filters?: ToolbarFilter[];
  savedViewsModule?: string;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState(searchParams.get("q") ?? "");

  function update(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page"); // reset pagination on any filter change
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  // Debounce search.
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== term) update({ q: term || null });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-48 max-w-sm">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={placeholder ?? t("common.search")}
          className="h-9 w-full rounded-md border border-line-strong bg-surface ps-8 pe-8 text-[13px] text-ink placeholder:text-ink-3 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
        />
        {term && (
          <button onClick={() => setTerm("")} className="absolute end-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" aria-label="Clear">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {filters.map((f) => (
        <div key={f.name} className="flex items-center">
          <Select
            value={searchParams.get(f.name) ?? ""}
            onChange={(e) => update({ [f.name]: e.target.value || null })}
            className="h-9 w-auto min-w-36"
            aria-label={f.label}
          >
            <option value="">{f.label}: {t("common.all")}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>
      ))}

      {filters.length > 0 && <SlidersHorizontal className={`h-4 w-4 ${pending ? "animate-pulse text-accent" : "text-ink-3"}`} />}

      <div className="ms-auto flex items-center gap-2">{savedViewsModule && <SavedViews module={savedViewsModule} />}{children}</div>
    </div>
  );
}
