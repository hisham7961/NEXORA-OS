import type { Metadata } from "next";
import type { PublishingItem } from "@prisma/client";
import { Share2 } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listPublishing, getCoverageMatrix, socialQuerySchema } from "@/domain/social";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { PageHeader, Panel, DataTable, StatusBadge, EmptyState, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { CoverageMatrix } from "@/components/social/coverage-matrix";
import { PublishingForm, RecurrenceButton } from "@/components/social/publishing-form";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { formatDateShort } from "@/lib/format";
import { humanize } from "@/lib/status";

export const metadata: Metadata = { title: "Social Publishing" };

export default async function SocialPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("social.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = socialQuerySchema.parse(sp);
  const canCreate = canAnywhere(principal, "social.create");
  const [{ rows, total }, coverage, lookups, options] = await Promise.all([
    listPublishing(principal, query),
    getCoverageMatrix(principal),
    getLookups(),
    canCreate ? getScopedOptions(principal, "social.create") : Promise.resolve(null),
  ]);

  const columns: Column<PublishingItem>[] = [
    { key: "type", header: "Content", render: (p) => <span className="capitalize">{p.contentType}</span> },
    { key: "platform", header: "Platform", render: (p) => <span className="capitalize">{p.platform ?? "—"}</span> },
    { key: "brand", header: "Brand", render: (p) => <BrandChip name={refName(lookups.brands, p.brandId)} color={p.brandId ? lookups.brands.get(p.brandId)?.meta : null} /> },
    { key: "date", header: "Publish", render: (p) => formatDateShort(p.publishDate, locale) },
    { key: "owner", header: "Owner", render: (p) => <UserChip name={refName(lookups.users, p.ownerId)} color={p.ownerId ? lookups.users.get(p.ownerId)?.meta : null} /> },
    { key: "checks", header: "Checkpoints", render: (p) => (
      <span className="flex gap-1">
        <Badge category={p.scheduledConfirmedAt ? "success" : "neutral"}>Sched</Badge>
        <Badge category={p.publishedConfirmedAt ? "success" : "neutral"}>Pub</Badge>
      </span>
    ) },
    { key: "status", header: "Status", render: (p) => <StatusBadge module="publishing" status={p.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Social Publishing"
        description="Planning, scheduling control and verification — not an API publisher (§10)."
        meta={<Badge>{total} items</Badge>}
        actions={
          canCreate && options ? (
            <div className="flex items-center gap-2">
              <RecurrenceButton options={{ brands: options.brands, countries: options.countries, users: options.users }} />
              <PublishingForm mode="create" options={{ brands: options.brands, countries: options.countries, users: options.users }} />
            </div>
          ) : undefined
        }
      />
      <CoverageMatrix data={coverage} locale={locale} />
      <ListToolbar
        placeholder="Search publishing…"
        filters={[{ name: "status", label: "Status", options: ["idea", "design", "review", "approved", "scheduled", "published", "failed"].map((v) => ({ value: v, label: humanize(v) })) }]}
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(p) => p.id}
          getRowHref={(p) => `/social/${p.id}`}
          empty={<EmptyState icon={<Share2 className="h-5 w-5" />} title="No publishing items" description="Plan posts, stories and reels; mark them Scheduled then Published as separate checkpoints." />}
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
