import type { Metadata } from "next";
import type { ApprovedAnswer } from "@prisma/client";
import { MessagesSquare, Inbox } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listAnswers, listAnswerRequests, answerQuerySchema } from "@/domain/answers";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { PageHeader, Panel, PanelHeader, DataTable, StatusBadge, EmptyState, Badge, type Column } from "@/components/ui";
import { ListToolbar } from "@/components/list/toolbar";
import { Pagination } from "@/components/list/pagination";
import { NewAnswerButton, RequestAnswerButton } from "@/components/answers/answer-controls";
import { BrandChip } from "@/components/entity-chips";
import { truncate } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export const metadata: Metadata = { title: "Approved Answers" };
import { getServerI18n } from "@/lib/server-i18n";

const CATEGORIES = ["product_info", "complaint", "usage", "ingredients", "medical", "returns", "shipping", "general"];

export default async function AnswersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("answers.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = answerQuerySchema.parse(sp);
  const canCreate = canAnywhere(principal, "answers.create");
  const canApprove = canAnywhere(principal, "answers.approve");
  const [{ rows, total }, requests, lookups, options] = await Promise.all([
    listAnswers(principal, query),
    canApprove ? listAnswerRequests(principal, "pending") : Promise.resolve([]),
    getLookups(),
    getScopedOptions(principal, "answers.view"),
  ]);

  const columns: Column<ApprovedAnswer>[] = [
    { key: "q", header: t("answers.col.question"), render: (a) => <Link href={`/answers/${a.id}`} className="font-medium text-ink hover:text-accent">{truncate(a.question, 80)}</Link> },
    { key: "brand", header: t("common.brand"), render: (a) => <BrandChip name={refName(lookups.brands, a.brandId)} color={a.brandId ? lookups.brands.get(a.brandId)?.meta : null} /> },
    { key: "category", header: t("common.category"), render: (a) => <span className="capitalize text-ink-3">{a.category?.replace(/_/g, " ") ?? "—"}</span> },
    { key: "lang", header: t("common.lang"), render: (a) => <span className="uppercase text-ink-3">{a.language}</span> },
    { key: "version", header: t("common.version"), align: "center", render: (a) => <span className="tabular text-ink-3">v{a.version}</span> },
    { key: "status", header: t("common.status"), render: (a) => <StatusBadge module="generic" status={a.status} /> },
  ];

  return (
    <>
      <PageHeader
        title={t("answers.title")}
        description={t("answers.subtitle")}
        meta={<Badge>{total} answers</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <RequestAnswerButton options={{ brands: options.brands, countries: options.countries }} />
            {canCreate && <NewAnswerButton options={{ brands: options.brands, countries: options.countries }} />}
          </div>
        }
      />
      {canApprove && requests.length > 0 && (
        <Panel className="mb-4">
          <PanelHeader title="Pending answer requests" icon={<Inbox className="h-4 w-4" />} description="Agents have asked for official answers." />
          <ul className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-ink">{r.question}</div>
                  <div className="text-[11px] text-ink-3">{r.brandId ? refName(lookups.brands, r.brandId) : "All brands"} · {formatDate(r.createdAt, locale)}</div>
                </div>
                {canCreate && <NewAnswerButton options={{ brands: options.brands, countries: options.countries }} />}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <ListToolbar
        placeholder={t("answers.searchPlaceholder")}
        filters={[
          { name: "status", label: t("common.status"), options: ["approved", "pending", "draft", "retired"].map((v) => ({ value: v, label: v })) },
          { name: "category", label: t("common.category"), options: CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, " ") })) },
          { name: "language", label: t("answers.language"), options: [{ value: "en", label: "EN" }, { value: "ar", label: "AR" }] },
        ]}
      />
      <Panel>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(a) => a.id}
          getRowHref={(a) => `/answers/${a.id}`}
          empty={<EmptyState icon={<MessagesSquare className="h-5 w-5" />} title="No approved answers yet" description="Create approved answers so agents give consistent, compliant responses." />}
        />
        {total > query.pageSize && <Pagination page={query.page} pageSize={query.pageSize} total={total} params={sp} />}
      </Panel>
    </>
  );
}
