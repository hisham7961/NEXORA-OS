import type { Metadata } from "next";
import type { KnowledgeArticle } from "@prisma/client";
import { BookOpen } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listKnowledge, knowledgeQuerySchema } from "@/domain/knowledge";
import { getLookups, refName } from "@/domain/lookups";
import { StatusBadge, EmptyState, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { BrandChip } from "@/components/entity-chips";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Knowledge Base" };

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("knowledge.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = knowledgeQuerySchema.parse(sp);
  const [{ rows, total }, lookups] = await Promise.all([listKnowledge(principal, query), getLookups()]);

  const columns: Column<KnowledgeArticle>[] = [
    { key: "title", header: "Article", render: (a) => a.title },
    { key: "category", header: "Category", render: (a) => a.category ?? "—" },
    { key: "brand", header: "Brand", render: (a) => <BrandChip name={refName(lookups.brands, a.brandId)} color={a.brandId ? lookups.brands.get(a.brandId)?.meta : null} /> },
    { key: "reviewed", header: "Last reviewed", align: "end", render: (a) => <span className="tabular text-ink-3">{formatDate(a.lastReviewedAt, locale)}</span> },
    { key: "status", header: "Status", render: (a) => <StatusBadge module="generic" status={a.status} /> },
  ];

  return (
    <ResourceList title="Knowledge Base" description="SOPs, policies, brand and product information." countLabel="articles"
      searchPlaceholder="Search knowledge…" columns={columns} rows={rows} getRowKey={(a) => a.id}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<BookOpen className="h-5 w-5" />} title="No articles yet" description="Document SOPs, policies and guides here so knowledge is searchable and versioned." />} />
  );
}
