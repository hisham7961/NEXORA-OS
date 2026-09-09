import type { Metadata } from "next";
import { MessageSquare, Hash } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { prisma } from "@/lib/db";
import { getLookups, refName } from "@/domain/lookups";
import { PageHeader, Panel, EmptyState, Badge } from "@/components/ui";

export const metadata: Metadata = { title: "Discussions" };

export default async function DiscussionsPage() {
  const { locale, denied } = await pageGuard("discussions.view");
  if (denied) return <AccessDenied locale={locale} />;
  const [channels, lookups] = await Promise.all([
    prisma.channel.findMany({ where: { archivedAt: null }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { members: true, messages: true } } } }),
    getLookups(),
  ]);

  return (
    <>
      <PageHeader title="Discussions" description="Structured business communication — reduce reliance on scattered WhatsApp groups (§20)." />
      <Panel>
        {channels.length === 0 ? (
          <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No channels yet" description="Create channels scoped to a brand, campaign, product or project. Messages can convert into tasks, cases, approvals or design requests." />
        ) : (
          <ul className="divide-y divide-line">
            {channels.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-2 text-ink-3"><Hash className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-ink">{c.name}</div>
                  <div className="text-xs text-ink-3">{c.brandId ? refName(lookups.brands, c.brandId) + " · " : ""}<span className="capitalize">{c.type}</span> · {c._count.members} members · {c._count.messages} messages</div>
                </div>
                {c.isPrivate && <Badge category="neutral">Private</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
