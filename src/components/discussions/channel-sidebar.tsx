"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hash, Lock, Megaphone } from "lucide-react";
import { useI18n } from "@/components/providers";

export interface ChannelListItem {
  id: string;
  name: string;
  type: string;
  isPrivate: boolean;
  unread: number;
}

export function ChannelSidebar({ channels, action }: { channels: ChannelListItem[]; action?: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const activeId = pathname.startsWith("/discussions/") ? pathname.split("/")[2] : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("cs.channels")}</span>
        {action}
      </div>
      <nav className="flex-1 overflow-y-auto px-1.5 pb-3">
        {channels.length === 0 ? (
          <p className="px-2 py-4 text-[12px] text-ink-3">{t("cs.noChannels")}</p>
        ) : (
          <ul className="space-y-0.5">
            {channels.map((c) => {
              const active = c.id === activeId;
              const Icon = c.type === "general" ? Hash : c.isPrivate ? Lock : Hash;
              return (
                <li key={c.id}>
                  <Link
                    href={`/discussions/${c.id}`}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ${active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2"}`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className={`flex-1 truncate ${c.unread > 0 && !active ? "font-semibold text-ink" : ""}`}>{c.name}</span>
                    {c.unread > 0 && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">{c.unread}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}

export const KIND_META: Record<string, { labelKey: string; icon: typeof Megaphone; className: string }> = {
  announcement: { labelKey: "chat.announcement", icon: Megaphone, className: "border-info/40 bg-info/5" },
  decision: { labelKey: "chat.decision", icon: Megaphone, className: "border-accent/40 bg-accent-soft/40" },
  action_required: { labelKey: "chat.actionRequired", icon: Megaphone, className: "border-warning/40 bg-warning/5" },
};
