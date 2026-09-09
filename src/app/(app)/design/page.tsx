import type { Metadata } from "next";
import type { DesignRequest } from "@prisma/client";
import { Palette } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listDesign, designQuerySchema } from "@/domain/design";
import { getLookups, refName } from "@/domain/lookups";
import { StatusBadge, EmptyState, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { formatDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Design Requests" };

export default async function DesignPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("design.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = designQuerySchema.parse(sp);
  const [{ rows, total }, lookups] = await Promise.all([listDesign(principal, query), getLookups()]);
  const now = new Date();

  const columns: Column<DesignRequest>[] = [
    { key: "asset", header: "Asset", render: (d) => <span className="capitalize">{d.assetType}</span> },
    { key: "brand", header: "Brand", render: (d) => <BrandChip name={refName(lookups.brands, d.brandId)} color={d.brandId ? lookups.brands.get(d.brandId)?.meta : null} /> },
    { key: "designer", header: "Designer", render: (d) => <UserChip name={refName(lookups.users, d.designerId)} color={d.designerId ? lookups.users.get(d.designerId)?.meta : null} /> },
    { key: "deadline", header: "Deadline", align: "end", render: (d) => <span className={d.deadline && d.deadline < now ? "text-critical tabular" : "text-ink-3 tabular"}>{formatDateShort(d.deadline, locale)}</span> },
    { key: "status", header: "Status", render: (d) => <StatusBadge module="design" status={d.status} /> },
  ];

  return (
    <ResourceList title="Design Requests" description="Creative operations from brief to approved delivery (§12)." countLabel="requests"
      searchPlaceholder="Search design requests…"
      filters={[{ name: "status", label: "Status", options: ["requested", "assigned", "designing", "internal_review", "revision", "waiting_approval", "approved", "delivered"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })) }]}
      columns={columns} rows={rows} getRowKey={(d) => d.id} getRowHref={(d) => `/design/${d.id}`}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<Palette className="h-5 w-5" />} title="No design requests" description="Marketing requests creative here; designers pick it up and deliver approved assets." />} />
  );
}
