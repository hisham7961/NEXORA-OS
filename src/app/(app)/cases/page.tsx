import type { Metadata } from "next";
import type { CustomerCase } from "@prisma/client";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listCases, caseQuerySchema } from "@/domain/cases";
import { getLookups, refName } from "@/domain/lookups";
import { StatusBadge, EmptyState, Badge, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { humanize, PRIORITY_CATEGORY } from "@/lib/status";

export const metadata: Metadata = { title: "Customer Cases" };

export default async function CasesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("cases.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = caseQuerySchema.parse(sp);
  const [{ rows, total }, lookups] = await Promise.all([listCases(principal, query), getLookups()]);

  const columns: Column<CustomerCase>[] = [
    { key: "type", header: "Type", render: (c) => humanize(c.type) },
    { key: "brand", header: "Brand", render: (c) => <BrandChip name={refName(lookups.brands, c.brandId)} color={c.brandId ? lookups.brands.get(c.brandId)?.meta : null} /> },
    { key: "desc", header: "Summary", render: (c) => <span className="text-ink-2">{c.description ?? "—"}</span> },
    { key: "priority", header: "Priority", render: (c) => <Badge category={PRIORITY_CATEGORY[c.priority] ?? "neutral"}>{c.priority}</Badge> },
    { key: "assigned", header: "Assigned", render: (c) => <UserChip name={refName(lookups.users, c.assignedToId)} color={c.assignedToId ? lookups.users.get(c.assignedToId)?.meta : null} /> },
    { key: "status", header: "Status", render: (c) => <StatusBadge module="customer_case" status={c.status} /> },
  ];

  return (
    <ResourceList title="Customer Cases" description="Internal customer service operations." countLabel="cases"
      searchPlaceholder="Search cases…"
      filters={[{ name: "status", label: "Status", options: ["new", "assigned", "waiting", "in_progress", "escalated", "resolved", "closed"].map((v) => ({ value: v, label: humanize(v) })) }]}
      columns={columns} rows={rows} getRowKey={(c) => c.id} getRowHref={(c) => `/cases/${c.id}`}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState title="No cases in your scope" description="Product questions, complaints, returns and refunds appear here." />} />
  );
}
