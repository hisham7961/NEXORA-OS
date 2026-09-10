import type { Metadata } from "next";
import type { CustomerCase } from "@prisma/client";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listCases, caseQuerySchema } from "@/domain/cases";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { StatusBadge, EmptyState, Badge, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { NewCaseButton } from "@/components/cases/new-case-button";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { humanize, PRIORITY_CATEGORY } from "@/lib/status";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Customer Cases" };

export default async function CasesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("cases.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = caseQuerySchema.parse(sp);
  const canCreate = canAnywhere(principal, "cases.create");
  const [{ rows, total }, lookups, options] = await Promise.all([
    listCases(principal, query),
    getLookups(),
    canCreate ? getScopedOptions(principal, "cases.create") : Promise.resolve(null),
  ]);

  const columns: Column<CustomerCase>[] = [
    { key: "type", header: t("common.type"), render: (c) => humanize(c.type) },
    { key: "brand", header: t("common.brand"), render: (c) => <BrandChip name={refName(lookups.brands, c.brandId)} color={c.brandId ? lookups.brands.get(c.brandId)?.meta : null} /> },
    { key: "desc", header: t("cases.col.summary"), render: (c) => <span className="text-ink-2">{c.description ?? "—"}</span> },
    { key: "priority", header: t("common.priority"), render: (c) => <Badge category={PRIORITY_CATEGORY[c.priority] ?? "neutral"}>{t(`priority.${c.priority}`)}</Badge> },
    { key: "assigned", header: t("common.assignedTo"), render: (c) => <UserChip name={refName(lookups.users, c.assignedToId)} color={c.assignedToId ? lookups.users.get(c.assignedToId)?.meta : null} /> },
    { key: "status", header: t("common.status"), render: (c) => <StatusBadge module="customer_case" status={c.status} /> },
  ];

  return (
    <ResourceList title={t("cases.title")} description={t("cases.subtitle")} countLabel={t("cases.count")} savedViewsModule="cases"
      searchPlaceholder={t("cases.searchPlaceholder")}
      actions={canCreate && options ? <NewCaseButton options={{ brands: options.brands, countries: options.countries, companies: options.companies, users: options.users }} /> : undefined}
      filters={[{ name: "status", label: t("common.status"), options: ["new", "assigned", "waiting", "in_progress", "escalated", "resolved", "closed"].map((v) => ({ value: v, label: t(`status.${v}`) })) }]}
      columns={columns} rows={rows} getRowKey={(c) => c.id} getRowHref={(c) => `/cases/${c.id}`}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState title={t("cases.empty")} description={t("cases.emptyBody")} />} />
  );
}
