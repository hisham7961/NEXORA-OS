"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, Search, Bell, Sun, Moon, Languages, ChevronDown, LogOut, Settings as SettingsIcon } from "lucide-react";
import { useShell } from "./shell-context";
import { useI18n, useTheme } from "@/components/providers";
import { Avatar, Kbd } from "@/components/ui";
import { signOutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export interface TopbarUser {
  name: string;
  email: string;
  avatarColor?: string | null;
  roleLabel?: string;
}

export function Topbar({ user, unread = 0 }: { user: TopbarUser; unread?: number }) {
  const { setCommandOpen, setMobileNavOpen } = useShell();
  const { t, locale } = useI18n();
  const { resolved, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function switchLocale() {
    const next = locale === "ar" ? "en" : "ar";
    document.cookie = `nexora_locale=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
    window.location.reload();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-md">
      <button
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Command palette trigger (§29) */}
      <button
        onClick={() => setCommandOpen(true)}
        className="group flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-line-strong bg-surface-2/60 px-3 text-start text-[13px] text-ink-3 hover:bg-surface-2 transition-colors"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{t("common.searchEverything")}</span>
        <span className="hidden sm:flex items-center gap-1">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="ms-auto flex items-center gap-0.5">
        <button
          onClick={switchLocale}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2"
          title={t("common.language")}
        >
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">{locale === "ar" ? "العربية" : "EN"}</span>
        </button>

        <button
          onClick={toggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2"
          title={t("common.theme")}
          aria-label={t("common.theme")}
        >
          {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <Link
          href="/notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute end-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[9.5px] font-bold text-white tabular">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>

        <div ref={menuRef} className="relative ms-1">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md py-1 ps-1 pe-2 hover:bg-surface-2"
          >
            <Avatar name={user.name} color={user.avatarColor} size={26} />
            <div className="hidden text-start leading-tight sm:block">
              <div className="max-w-32 truncate text-[12.5px] font-medium text-ink">{user.name}</div>
              {user.roleLabel && <div className="max-w-32 truncate text-[10.5px] text-ink-3">{user.roleLabel}</div>}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-ink-3" />
          </button>

          {menuOpen && (
            <div className="absolute end-0 mt-1.5 w-56 rounded-lg border border-line bg-surface p-1 shadow-lg animate-slide-up">
              <div className="px-2.5 py-2">
                <div className="truncate text-[13px] font-medium text-ink">{user.name}</div>
                <div className="truncate text-xs text-ink-3">{user.email}</div>
              </div>
              <div className="my-1 h-px bg-line" />
              <Link
                href="/settings/profile"
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink"
                onClick={() => setMenuOpen(false)}
              >
                <SettingsIcon className="h-4 w-4" /> {t("common.settings")}
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink")}
                >
                  <LogOut className="h-4 w-4" /> {t("common.signOut")}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
