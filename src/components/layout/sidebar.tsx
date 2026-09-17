"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAVIGATION } from "@/config/navigation";
import { useI18n } from "@/components/providers";
import { useShell } from "./shell-context";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ allowed }: { allowed: string[] }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { mobileNavOpen, setMobileNavOpen } = useShell();
  const allowedSet = new Set(allowed);

  const nav = (
    <nav className="flex-1 overflow-y-auto px-2.5 py-3">
      {NAVIGATION.map((group, gi) => {
        const items = group.items.filter((it) => allowedSet.has(it.key));
        if (items.length === 0) return null;
        return (
          <div key={gi} className={cn(gi > 0 && "mt-4")}>
            {group.labelKey && (
              <div className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">
                {t(group.labelKey)}
              </div>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-accent-soft text-accent"
                          : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={2} />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const brandHeader = (
    <div className="flex h-14 items-center gap-2.5 px-4 border-b border-line">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-on-accent text-[13px] font-bold shadow-sm">
        N
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-semibold text-ink">{t("app.name")}</div>
        <div className="truncate text-[10.5px] text-ink-3">{t("app.tagline")}</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-e border-line bg-surface">
        {brandHeader}
        {nav}
      </aside>

      {/* Mobile off-canvas */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-[var(--overlay)] animate-fade-in" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative flex w-64 flex-col border-e border-line bg-surface animate-slide-up">
            <div className="flex items-center justify-between border-b border-line pe-2">
              <div className="flex-1">{brandHeader}</div>
              <button className="p-2 text-ink-3 hover:text-ink" onClick={() => setMobileNavOpen(false)} aria-label={t("common.close")}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
