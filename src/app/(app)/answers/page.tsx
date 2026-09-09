import type { Metadata } from "next";
import type { ApprovedAnswer } from "@prisma/client";
import { MessagesSquare } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listAnswers, answerQuerySchema } from "@/domain/answers";
import { getLookups, refName } from "@/domain/lookups";
import { StatusBadge, EmptyState, Badge, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { BrandChip } from "@/components/entity-chips";
import { truncate } from "@/lib/utils";

export const metadata: Metadata = { title: "Approved Answers" };

export default async function AnswersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("answers.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = answerQuerySchema.parse(sp);
  const [{ rows, total }, lookups] = await Promise.all([listAnswers(principal, query), getLookups()]);

  const columns: Column<ApprovedAnswer>[] = [
    { key: "q", header: "Question", render: (a) => <span className="font-medium">{truncate(a.question, 80)}</span> },
    { key: "brand", header: "Brand", render: (a) => <BrandChip name={refName(lookups.brands, a.brandId)} color={a.brandId ? lookups.brands.get(a.brandId)?.meta : null} /> },
    { key: "category", header: "Category", render: (a) => a.category ?? "—" },
    { key: "lang", header: "Lang", render: (a) => <span className="uppercase text-ink-3">{a.language}</span> },
    { key: "version", header: "Ver", align: "center", render: (a) => <span className="tabular text-ink-3">v{a.version}</span> },
    { key: "status", header: "Status", render: (a) => <StatusBadge module="generic" status={a.status} /> },
  ];

  return (
    <ResourceList title="Approved Answers" description="Customer service must use approved answers — never silently edit them (§18)."
      countLabel="answers" searchPlaceholder="Search questions…"
      actions={<Badge category="info">Approved library</Badge>}
      filters={[{ name: "status", label: "Status", options: ["approved", "pending", "draft", "retired"].map((v) => ({ value: v, label: v })) }]}
      columns={columns} rows={rows} getRowKey={(a) => a.id}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<MessagesSquare className="h-5 w-5" />} title="No approved answers yet" description="Management creates approved answers so agents give consistent, compliant responses." />} />
  );
}
