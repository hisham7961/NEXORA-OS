"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, ArrowRight, Plus } from "lucide-react";
import { NAVIGATION, type CreateCommand } from "@/config/navigation";
import { useShell } from "./shell-context";
import { useI18n } from "@/components/providers";
import { Kbd } from "@/components/ui";
import { cn } from "@/lib/utils";

interface SearchHit {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

export function CommandPalette({ allowed, createCommands = [] }: { allowed: string[]; createCommands?: CreateCommand[] }) {
  const { commandOpen, setCommandOpen } = useShell();
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [bookmarks, setBookmarks] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const allowedSet = useMemo(() => new Set(allowed), [allowed]);

  // Static navigation commands (permission-filtered).
  const navCommands = useMemo(() => {
    const cmds: SearchHit[] = [];
    for (const group of NAVIGATION) {
      for (const item of group.items) {
        if (allowedSet.has(item.key)) {
          cmds.push({ type: "nav", id: item.key, title: t(item.labelKey), href: item.href, subtitle: "Go to" });
        }
      }
    }
    return cmds;
  }, [allowedSet, t]);

  // "Create …" commands (§29) — deep-link to the module with ?new=1.
  const createHits = useMemo<SearchHit[]>(
    () => createCommands.map((c) => ({ type: "create", id: c.key, title: c.label, href: c.href, subtitle: "Create" })),
    [createCommands],
  );

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navCommands.slice(0, 8);
    return navCommands.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 8);
  }, [query, navCommands]);

  const filteredCreate = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return createHits.slice(0, 5);
    return createHits.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 6);
  }, [query, createHits]);

  const results = useMemo(() => (query.trim() ? [...filteredCreate, ...filteredNav, ...hits] : [...filteredCreate, ...bookmarks, ...filteredNav]), [filteredCreate, filteredNav, hits, bookmarks, query]);

  useEffect(() => {
    if (commandOpen) {
      setQuery("");
      setHits([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
      // Load personal favorites + recent items as default suggestions (§10/§11).
      Promise.all([fetch("/api/v1/favorites").then((r) => r.json()).catch(() => null), fetch("/api/v1/recent").then((r) => r.json()).catch(() => null)]).then(([fav, rec]) => {
        const favHits: SearchHit[] = (fav?.data ?? []).filter((f: { href?: string }) => f.href).slice(0, 6).map((f: { entityType: string; entityId: string; label?: string; href: string }) => ({ type: "favorite", id: f.entityId, title: f.label ?? f.entityType, subtitle: "Favorite", href: f.href }));
        const recHits: SearchHit[] = (rec?.data ?? []).filter((f: { href?: string }) => f.href).slice(0, 6).map((f: { entityType: string; entityId: string; label?: string; href: string }) => ({ type: "recent", id: f.entityId, title: f.label ?? f.entityType, subtitle: "Recent", href: f.href }));
        // Dedupe recents already in favorites.
        const favKeys = new Set(favHits.map((h) => h.href));
        setBookmarks([...favHits, ...recHits.filter((h) => !favKeys.has(h.href))]);
      });
    }
  }, [commandOpen]);

  // Debounced live entity search against the versioned API.
  useEffect(() => {
    if (!commandOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return;
        const json = await res.json();
        if (json.ok) setHits(json.data as SearchHit[]);
      } catch {
        /* ignore aborted / network */
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [query, commandOpen]);

  useEffect(() => {
    setActive(0);
  }, [results.length]);

  if (!commandOpen) return null;

  function choose(hit: SearchHit) {
    setCommandOpen(false);
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setCommandOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active]);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-[var(--overlay)] animate-fade-in" onClick={() => setCommandOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-lg animate-slide-up"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="h-4 w-4 text-ink-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("common.searchEverything")}
            className="h-12 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-[13px] text-ink-3">{t("common.noResults")}</div>
          ) : (
            <ul>
              {results.map((hit, i) => (
                <li key={`${hit.type}-${hit.id}`}>
                  <button
                    onClick={() => choose(hit)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-start",
                      i === active ? "bg-accent-soft" : "hover:bg-surface-2",
                    )}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-surface-2 text-ink-3">
                      {hit.type === "create" ? <Plus className="h-3.5 w-3.5" /> : hit.type === "nav" ? <ArrowRight className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{hit.title}</span>
                      {hit.subtitle && <span className="block truncate text-xs text-ink-3">{hit.subtitle}</span>}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-ink-3">{hit.type}</span>
                    {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-ink-3" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
