import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Hash, Lock } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere, ForbiddenError } from "@/lib/permissions/engine";
import { getChannel, listMessages, listPinned } from "@/domain/discussions";
import { getLookups } from "@/domain/lookups";
import { listSelectableUsers } from "@/domain/permissions-admin";
import { ChannelWorkspace, type WsMessage, type UserMap } from "@/components/discussions/channel-workspace";
import { MarkRead } from "@/components/discussions/mark-read";
import { ChannelLive } from "@/components/discussions/channel-live";

export const metadata: Metadata = { title: "Channel" };

function toWs(m: Awaited<ReturnType<typeof listMessages>>[number]): WsMessage {
  return {
    id: m.id, authorId: m.authorId, body: m.body, kind: m.kind, isPinned: m.isPinned,
    editedAt: m.editedAt ? m.editedAt.toISOString() : null, createdAt: m.createdAt.toISOString(),
    parentId: m.parentId, replyCount: m.replyCount, mentions: m.mentions, reactions: m.reactions,
  };
}

export default async function ChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { principal, locale } = await pageGuard("discussions.view");
  const { id } = await params;

  let channel;
  try {
    channel = await getChannel(principal, id);
  } catch (e) {
    if (e instanceof ForbiddenError) return <AccessDenied locale={locale} />;
    throw e;
  }
  if (!channel) notFound();

  const [messages, pinned, lookups, users] = await Promise.all([
    listMessages(principal, id),
    listPinned(principal, id),
    getLookups(),
    listSelectableUsers(),
  ]);
  const userMap: UserMap = {};
  for (const [uid, u] of lookups.users) userMap[uid] = { name: u.name, color: u.meta };
  const canManage = canAnywhere(principal, "discussions.manage");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MarkRead channelId={id} />
      <ChannelLive channelId={id} />
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        {channel.isPrivate ? <Lock className="h-4 w-4 text-ink-3" /> : <Hash className="h-4 w-4 text-ink-3" />}
        <h1 className="text-[14px] font-semibold text-ink">{channel.name}</h1>
        {channel.description && <span className="truncate text-[12px] text-ink-3">— {channel.description}</span>}
      </div>
      <ChannelWorkspace
        channelId={id}
        channelName={channel.name}
        messages={messages.map(toWs)}
        pinned={pinned.map(toWs)}
        users={userMap}
        currentUserId={principal.userId}
        canManage={canManage}
        approverOptions={users.map((u) => ({ id: u.id, label: u.name }))}
      />
    </div>
  );
}
