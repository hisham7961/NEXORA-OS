"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Star, BookmarkPlus, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/providers";
import { toggleFavoriteAction, saveViewAction, deleteSavedViewAction } from "@/app/actions/personal";

/** Star toggle to favorite an entity (detail pages). */
export function FavoriteStar({ entityType, entityId, label, href, initial }: { entityType: string; entityId: string; label?: string; href?: string; initial?: boolean }) {
  const { toast } = useToast();
  const [fav, setFav] = useState(!!initial);
  const [pending, start] = useTransition();
  return (
    <button title={fav ? "Remove favorite" : "Add favorite"} disabled={pending} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line ${fav ? "text-amber-500" : "text-ink-3 hover:text-ink"}`}
      onClick={() => start(async () => {
        const r = await toggleFavoriteAction({ entityType, entityId, label, href });
        if (r.ok) setFav(r.data?.favorited ?? !fav); else toast({ kind: "error", title: r.error });
      })}>
      <Star className={`h-4 w-4 ${fav ? "fill-current" : ""}`} />
    </button>
  );
}

/** Records a recent-item view once on mount (detail pages). Renders nothing. */
export function RecordRecent({ entityType, entityId, label, href }: { entityType: string; entityId: string; label?: string; href?: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return; fired.current = true;
    fetch("/api/v1/recent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType, entityId, label, href }) }).catch(() => {});
  }, [entityType, entityId, label, href]);
  return null;
}

type SavedView = { id: string; name: string; filtersJson: string; isShared: boolean; userId: string | null };

/** Saved-views control for list toolbars: apply / save current filters / delete. */
export function SavedViews({ module }: { module: string }) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams(); const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedView[] | null>(null);
  const [pending, start] = useTransition();

  const load = () => { fetch(`/api/v1/saved-views?module=${encodeURIComponent(module)}`).then((r) => r.json()).then((j) => setViews(j.data ?? [])).catch(() => setViews([])); };
  useEffect(() => { if (open && views === null) load(); }, [open]); // eslint-disable-line

  const apply = (v: SavedView) => { setOpen(false); router.push(`${pathname}${v.filtersJson ? `?${v.filtersJson}` : ""}`); };
  const saveCurrent = () => start(async () => {
    const name = window.prompt("Name this view"); if (!name) return;
    const filtersJson = params.toString();
    const r = await saveViewAction({ module, name, filtersJson });
    if (r.ok) { toast({ kind: "success", title: "View saved" }); load(); } else toast({ kind: "error", title: r.error });
  });
  const remove = (id: string) => start(async () => { const r = await deleteSavedViewAction(id); if (r.ok) load(); else toast({ kind: "error", title: r.error }); });

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}><BookmarkPlus className="h-4 w-4" /> Views <ChevronDown className="h-3.5 w-3.5" /></Button>
      {open && (
        <div className="absolute end-0 z-20 mt-1 w-64 rounded-lg border border-line bg-surface p-1 shadow-lg">
          <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] text-ink hover:bg-surface-2" disabled={pending} onClick={saveCurrent}><BookmarkPlus className="h-3.5 w-3.5" /> Save current view</button>
          <div className="my-1 border-t border-line" />
          {views === null ? <div className="px-2 py-1.5 text-[12px] text-ink-3">Loading…</div>
            : views.length === 0 ? <div className="px-2 py-1.5 text-[12px] text-ink-3">No saved views yet.</div>
            : views.map((v) => (
              <div key={v.id} className="group flex items-center justify-between gap-1 rounded px-2 py-1 hover:bg-surface-2">
                <button className="min-w-0 flex-1 truncate text-start text-[13px] text-ink-2" onClick={() => apply(v)}>{v.name}{v.isShared ? " ·shared" : ""}</button>
                <button className="text-ink-3 opacity-0 hover:text-critical group-hover:opacity-100" onClick={() => remove(v.id)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
