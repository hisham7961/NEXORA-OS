import type { Metadata } from "next";
import type { KnowledgeArticle } from "@prisma/client";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listKnowledge, knowledgeQuerySchema } from "@/domain/knowledge";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { PageHeader, Panel, DataTable, StatusBadge, EmptyState, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { NewArticleButton } from "@/components/knowledge/article-controls";
import { BrandChip } from "@/components/entity-chips";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Knowledge Base" };

const CATEGORIES = ["sop", "company_policy", "brand_info", "product_info", "marketing", "customer_service", "regulatory", "commerce", "creative", "hr_ops", "custom"];

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("knowledge.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = knowledgeQuerySchema.parse(sp);
  const canCreate = canAnywhere(principal, "knowledge.create");
  const [{ rows, total }, lookups, options] = await Promise.all([
    listKnowledge(principal, query),
    getLookups(),
    canCreate ? getScopedOptions(principal, "knowledge.create") : Promise.resolve(null),
  ]);
  const now = new Date();

  const columns: Column<KnowledgeArticle>[] = [
    { key: "title", header: "Article", render: (a) => <Link href={`/knowledge/${a.id}`} className="font-medium text-ink hover:text-accent">{a.title}</Link> },
    { key: "category", header: "Category", render: (a) => <span className="capitalize text-ink-3">{a.category?.replace(/_/g, " ") ?? "—"}</span> },
    { key: "brand", header: "Brand", render: (a) => <BrandChip name={refName(lookups.brands, a.brandId)} color={a.brandId ? lookups.brands.get(a.brandId)?.meta : null} /> },
    { key: "ver", header: "Ver", align: "center", render: (a) => <span className="tabular text-ink-3">v{a.version}</span> },
    { key: "review", header: "Review due", align: "end", render: (a) => <span className={`tabular ${a.reviewDueAt && a.reviewDueAt < now ? "text-critical" : "text-ink-3"}`}>{a.reviewDueAt ? formatDate(a.reviewDueAt, locale) : "—"}</span> },
    { key: "status", header: "Status", render: (a) => <StatusBadge module="generic" status={a.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Knowledge Base"
        description="SOPs, policies and reference — reviewed, versioned and never destroyed on edit (§18–19)."
        meta={<Badge>{total} articles</Badge>}
        actions={canCreate && options ? <NewArticleButton options={{ brands: options.brands, countries: options.countries, users: options.users }} /> : undefined}
      />
      <ListToolbar
        placeholder="Search articles…"
        filters={[
          { name: "category", label: "Category", options: CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, " ") })) },
          { name: "status", label: "Status", options: ["published", "in_review", "draft", "archived"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })) },
        ]}
      />
      <Panel>
        <DataTable columns={columns} rows={rows} getRowKey={(a) => a.id} getRowHref={(a) => `/knowledge/${a.id}`}
          empty={<EmptyState icon={<BookOpen className="h-5 w-5" />} title="No articles yet" description="Document SOPs, policies and product knowledge so the team has one source of truth." />} />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
