"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Pin, PinOff, Reply, SmilePlus, Pencil, Trash2, Zap, X, CheckSquare, LifeBuoy, Stamp, Palette } from "lucide-react";
import { Button, Textarea, Select } from "@/components/ui";
import { Avatar } from "@/components/ui";
import { useToast, useI18n } from "@/components/providers";
import { postMessageAction, editMessageAction, deleteMessageAction, pinMessageAction, reactMessageAction, convertMessageAction } from "@/app/actions/discussions";
import { KIND_META } from "@/components/discussions/channel-sidebar";
import type { ConvertTarget } from "@/domain/discussions";

export interface WsMessage {
  id: string;
  authorId: string;
  body: string;
  kind: string;
  isPinned: boolean;
  editedAt: string | null;
  createdAt: string;
  parentId: string | null;
  replyCount: number;
  mentions: string[];
  reactions: { emoji: string; count: number; mine: boolean }[];
}

export type UserMap = Record<string, { name: string; color?: string | null }>;

const EMOJIS = ["👍", "🎉", "✅", "👀", "🔥", "❤️"];
const CONVERT: { target: ConvertTarget; labelKey: string; icon: typeof CheckSquare }[] = [
  { target: "task", labelKey: "chat.conv.task", icon: CheckSquare },
  { target: "case", labelKey: "chat.conv.case", icon: LifeBuoy },
  { target: "approval", labelKey: "chat.conv.approval", icon: Stamp },
  { target: "design", labelKey: "chat.conv.design", icon: Palette },
];

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString();
}

export function ChannelWorkspace({
  channelId,
  channelName,
  messages,
  pinned,
  users,
  currentUserId,
  canManage,
  approverOptions,
}: {
  channelId: string;
  channelName: string;
  messages: WsMessage[];
  pinned: WsMessage[];
  users: UserMap;
  currentUserId: string;
  canManage: boolean;
  approverOptions: { id: string; label: string }[];
}) {
  const { t } = useI18n();
  const [thread, setThread] = useState<WsMessage | null>(null);
  const [convert, setConvert] = useState<{ msg: WsMessage; target: ConvertTarget } | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {pinned.length > 0 && (
          <div className="border-b border-line bg-surface-2/40 px-4 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3"><Pin className="h-3 w-3" /> {t("chat.pinned")}</div>
            <ul className="space-y-1">
              {pinned.map((m) => (
                <li key={m.id} className="truncate text-[12.5px] text-ink-2"><span className="font-medium text-ink">{users[m.authorId]?.name ?? t("chat.someone")}:</span> {m.body}</li>
              ))}
            </ul>
          </div>
        )}
        <MessageScroller
          messages={messages}
          users={users}
          currentUserId={currentUserId}
          canManage={canManage}
          channelId={channelId}
          onReply={setThread}
          onConvert={(msg, target) => setConvert({ msg, target })}
        />
        <Composer channelId={channelId} placeholder={t("chat.messagePh", { channel: channelName })} />
      </div>

      {thread && (
        <ThreadPanel channelId={channelId} root={thread} users={users} currentUserId={currentUserId} canManage={canManage} onClose={() => setThread(null)} onConvert={(msg, target) => setConvert({ msg, target })} />
      )}

      {convert && (
        <ConvertDialog channelId={channelId} message={convert.msg} target={convert.target} approverOptions={approverOptions} onClose={() => setConvert(null)} />
      )}
    </div>
  );
}

function MessageScroller({ messages, users, currentUserId, canManage, channelId, onReply, onConvert }: {
  messages: WsMessage[]; users: UserMap; currentUserId: string; canManage: boolean; channelId: string;
  onReply: (m: WsMessage) => void; onConvert: (m: WsMessage, t: ConvertTarget) => void;
}) {
  const { t } = useI18n();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView(); }, [messages.length]);
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {messages.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-3">{t("chat.noMessages")}</p>
      ) : (
        <ul className="space-y-0.5">
          {messages.map((m) => (
            <MessageItem key={m.id} m={m} users={users} currentUserId={currentUserId} canManage={canManage} channelId={channelId} onReply={onReply} onConvert={onConvert} />
          ))}
        </ul>
      )}
      <div ref={endRef} />
    </div>
  );
}

function MessageItem({ m, users, currentUserId, canManage, channelId, onReply, onConvert, inThread }: {
  m: WsMessage; users: UserMap; currentUserId: string; canManage: boolean; channelId: string;
  onReply?: (m: WsMessage) => void; onConvert: (m: WsMessage, t: ConvertTarget) => void; inThread?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [menu, setMenu] = useState(false);
  const author = users[m.authorId];
  const isMine = m.authorId === currentUserId;
  const kind = KIND_META[m.kind];

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => { const r = await fn(); if (r.ok) router.refresh(); else toast({ kind: "error", title: r.error ?? t("chat.failed") }); });

  return (
    <li className={`group -mx-2 rounded-md px-2 py-1.5 hover:bg-surface-2/40 ${kind ? `border-s-2 ${kind.className}` : ""}`}>
      <div className="flex gap-2.5">
        <Avatar name={author?.name ?? "?"} size={28} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-ink">{author?.name ?? t("chat.unknown")}</span>
            <span className="text-[11px] text-ink-3">{timeAgo(m.createdAt)}{m.editedAt ? ` · ${t("chat.edited")}` : ""}</span>
            {kind && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-2">{t(kind.labelKey)}</span>}
            {m.isPinned && <Pin className="h-3 w-3 text-accent" />}
          </div>
          {editing ? (
            <div className="mt-1 space-y-1.5">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-14 text-[13px]" />
              <div className="flex gap-2">
                <Button size="sm" variant="primary" disabled={pending} onClick={() => run(async () => { const r = await editMessageAction(channelId, m.id, draft); if (r.ok) setEditing(false); return r; })}>{t("common.save")}</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(m.body); }}>{t("common.cancel")}</Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-[13px] text-ink-2">{renderBody(m.body, users, m.mentions)}</p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-1">
            {m.reactions.map((r) => (
              <button key={r.emoji} disabled={pending} onClick={() => run(() => reactMessageAction(channelId, m.id, r.emoji))} className={`rounded-full border px-1.5 py-0.5 text-[11px] ${r.mine ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2 hover:bg-surface-2"}`}>
                {r.emoji} {r.count}
              </button>
            ))}
            {!inThread && m.replyCount > 0 && (
              <button onClick={() => onReply?.(m)} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-accent hover:bg-surface-2">{m.replyCount} {m.replyCount === 1 ? t("chat.reply") : t("chat.replies")}</button>
            )}
          </div>
        </div>

        {/* hover actions */}
        <div className="relative flex items-start gap-0.5 opacity-0 group-hover:opacity-100">
          <div className="flex items-center rounded-md border border-line bg-surface">
            <EmojiPicker onPick={(e) => run(() => reactMessageAction(channelId, m.id, e))} />
            {!inThread && onReply && <IconBtn title={t("chat.replyInThread")} onClick={() => onReply(m)}><Reply className="h-3.5 w-3.5" /></IconBtn>}
            {canManage && <IconBtn title={m.isPinned ? t("chat.unpin") : t("chat.pin")} onClick={() => run(() => pinMessageAction(channelId, m.id, !m.isPinned))}>{m.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</IconBtn>}
            <IconBtn title={t("chat.convertToWork")} onClick={() => setMenu((v) => !v)}><Zap className="h-3.5 w-3.5" /></IconBtn>
            {isMine && <IconBtn title={t("actions.edit")} onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></IconBtn>}
            {(isMine || canManage) && <IconBtn title={t("actions.delete")} onClick={() => run(() => deleteMessageAction(channelId, m.id))}><Trash2 className="h-3.5 w-3.5" /></IconBtn>}
          </div>
          {menu && (
            <div className="absolute end-0 top-8 z-20 w-44 rounded-md border border-line bg-surface p-1 shadow-lg">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-3">{t("chat.convertTo")}</div>
              {CONVERT.map((c) => (
                <button key={c.target} onClick={() => { setMenu(false); onConvert(m, c.target); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12.5px] text-ink-2 hover:bg-surface-2">
                  <c.icon className="h-3.5 w-3.5" /> {t(c.labelKey)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return <button title={title} onClick={onClick} className="p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">{children}</button>;
}

function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <IconBtn title={t("chat.react")} onClick={() => setOpen((v) => !v)}><SmilePlus className="h-3.5 w-3.5" /></IconBtn>
      {open && (
        <div className="absolute end-0 top-8 z-20 flex gap-0.5 rounded-md border border-line bg-surface p-1 shadow-lg">
          {EMOJIS.map((e) => <button key={e} onClick={() => { onPick(e); setOpen(false); }} className="rounded p-1 text-[15px] hover:bg-surface-2">{e}</button>)}
        </div>
      )}
    </div>
  );
}

function renderBody(body: string, users: UserMap, mentions: string[]) {
  const names = new Set(mentions.map((id) => users[id]?.name).filter(Boolean) as string[]);
  const parts = body.split(/(@[a-zA-Z0-9._-]+)/g);
  return parts.map((p, i) => {
    if (p.startsWith("@")) {
      const handle = p.slice(1).toLowerCase();
      const matched = [...names].some((n) => n.toLowerCase().replace(/\s+/g, "").startsWith(handle) || n.toLowerCase().split(/\s+/)[0] === handle);
      if (matched || mentions.length) return <span key={i} className="rounded bg-accent-soft px-1 font-medium text-accent">{p}</span>;
    }
    return <span key={i}>{p}</span>;
  });
}

function Composer({ channelId, placeholder, parentId, onSent }: { channelId: string; placeholder: string; parentId?: string; onSent?: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("message");

  const send = () => {
    if (!body.trim()) return;
    start(async () => {
      const r = await postMessageAction(channelId, body.trim(), kind, parentId);
      if (r.ok) { setBody(""); setKind("message"); router.refresh(); onSent?.(); }
      else toast({ kind: "error", title: r.error });
    });
  };

  return (
    <div className="border-t border-line p-3">
      <div className="rounded-lg border border-line bg-surface focus-within:border-accent">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
          placeholder={placeholder}
          className="min-h-[44px] border-0 bg-transparent text-[13px] focus:ring-0"
        />
        <div className="flex items-center justify-between gap-2 border-t border-line px-2 py-1.5">
          {!parentId ? (
            <Select value={kind} onChange={(e) => setKind(e.target.value)} className="h-7 w-40 text-[12px]">
              <option value="message">{t("chat.message")}</option>
              <option value="announcement">{t("chat.announcement")}</option>
              <option value="decision">{t("chat.decision")}</option>
              <option value="action_required">{t("chat.actionRequired")}</option>
            </Select>
          ) : <span className="text-[11px] text-ink-3">{t("chat.replyKind")}</span>}
          <Button size="sm" variant="primary" disabled={pending || !body.trim()} onClick={send}><Send className="h-3.5 w-3.5" /> {t("chat.send")}</Button>
        </div>
      </div>
      <p className="mt-1 text-[10.5px] text-ink-3">{t("chat.composerHint")}</p>
    </div>
  );
}

function ThreadPanel({ channelId, root, users, currentUserId, canManage, onClose, onConvert }: {
  channelId: string; root: WsMessage; users: UserMap; currentUserId: string; canManage: boolean; onClose: () => void; onConvert: (m: WsMessage, t: ConvertTarget) => void;
}) {
  const { t } = useI18n();
  const [replies, setReplies] = useState<WsMessage[] | null>(null);
  useEffect(() => {
    fetch(`/api/v1/discussions/${channelId}/messages`).catch(() => {}); // warm
    fetch(`/api/v1/discussions/${channelId}/thread?parent=${root.id}`).then(async (r) => {
      if (r.ok) { const j = await r.json(); setReplies(j.data ?? []); }
    }).catch(() => setReplies([]));
  }, [channelId, root.id]);

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-s border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="text-[13px] font-semibold text-ink">{t("chat.thread")}</span>
        <button onClick={onClose} className="text-ink-3 hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-0.5">
          <MessageItem m={root} users={users} currentUserId={currentUserId} canManage={canManage} channelId={channelId} onConvert={onConvert} inThread />
          <li className="my-1 border-t border-line" />
          {replies === null ? <li className="py-2 text-[12px] text-ink-3">{t("chat.loading")}</li> : replies.map((r) => (
            <MessageItem key={r.id} m={r} users={users} currentUserId={currentUserId} canManage={canManage} channelId={channelId} onConvert={onConvert} inThread />
          ))}
        </ul>
      </div>
      <Composer channelId={channelId} placeholder={t("chat.replyPh")} parentId={root.id} onSent={() => { setReplies(null); }} />
    </aside>
  );
}

function ConvertDialog({ channelId, message, target, approverOptions, onClose }: {
  channelId: string; message: WsMessage; target: ConvertTarget; approverOptions: { id: string; label: string }[]; onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const { t } = useI18n();
  const [title, setTitle] = useState(message.body.split("\n")[0].slice(0, 120));
  const [approver, setApprover] = useState("");
  const labels: Record<ConvertTarget, string> = { task: t("chat.target.task"), case: t("chat.target.case"), approval: t("chat.target.approval"), design: t("chat.target.design") };

  const go = () => start(async () => {
    const r = await convertMessageAction(channelId, message.id, target, { title, approverIds: target === "approval" && approver ? [approver] : undefined });
    if (r.ok) { toast({ kind: "success", title: t("chat.createdLabel", { label: labels[target] }) }); router.refresh(); const href = (r.data as { href?: string })?.href; onClose(); if (href) router.push(href); }
    else toast({ kind: "error", title: r.error });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-[15px] font-semibold text-ink">{t("chat.convertToLabel", { label: labels[target] })}</h3>
        <p className="mb-3 text-[12px] text-ink-3">{t("chat.backlink")}</p>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("chat.title")}</label>
        <Textarea value={title} onChange={(e) => setTitle(e.target.value)} className="mb-3 min-h-14 text-[13px]" />
        {target === "approval" && (
          <>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t("chat.approver")}</label>
            <Select value={approver} onChange={(e) => setApprover(e.target.value)} className="mb-3 w-full"><option value="">{t("chat.selectDots")}</option>{approverOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" disabled={pending || !title.trim() || (target === "approval" && !approver)} onClick={go}>{t("chat.createLabel", { label: labels[target] })}</Button>
        </div>
      </div>
    </div>
  );
}
