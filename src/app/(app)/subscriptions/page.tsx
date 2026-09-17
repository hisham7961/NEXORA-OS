import type { Metadata } from "next";
import type { Subscription } from "@prisma/client";
import { CreditCard } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listSubscriptions, subscriptionQuerySchema } from "@/domain/subscriptions";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { StatusBadge, EmptyState, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { SubscriptionForm } from "@/components/subscriptions/subscription-controls";
import { formatCurrency, formatDate } from "@/lib/format";
import { daysUntil } from "@/lib/utils";

export const metadata: Metadata = { title: "Subscriptions" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("subscriptions.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = subscriptionQuerySchema.parse(sp);
  const canCreate = canAnywhere(principal, "subscriptions.create");
  const [{ rows, total }, lookups, options] = await Promise.all([
    listSubscriptions(principal, query),
    getLookups(),
    canCreate ? getScopedOptions(principal, "subscriptions.create") : Promise.resolve(null),
  ]);
  const showValues = canAnywhere(principal, "finance.view_values");

  const columns: Column<Subscription>[] = [
    { key: "provider", header: t("subs.col.provider"), render: (s) => s.provider },
    { key: "company", header: t("common.company"), render: (s) => refName(lookups.companies, s.companyId) },
    { key: "plan", header: t("subs.col.plan"), render: (s) => s.plan ?? "—" },
    { key: "cost", header: t("subs.col.cost"), align: "end", render: (s) => (showValues ? formatCurrency(s.cost, s.currency, locale) : "—") },
    { key: "cycle", header: t("subs.col.cycle"), render: (s) => <span className="capitalize text-ink-3">{s.billingCycle}</span> },
    { key: "renewal", header: t("subs.col.renews"), align: "end", render: (s) => { const d = daysUntil(s.renewalDate); return <span className={d !== null && d < 14 ? "text-critical tabular" : "text-ink-3 tabular"}>{formatDate(s.renewalDate, locale)}</span>; } },
    { key: "status", header: t("common.status"), render: (s) => <StatusBadge module="subscription" status={s.status} /> },
  ];

  return (
    <ResourceList title={t("subs.title")} description={t("subs.subtitle")} countLabel={t("subs.count")} savedViewsModule="subscriptions"
      searchPlaceholder={t("subs.searchPlaceholder")}
      filters={[{ name: "status", label: t("common.status"), options: ["active", "expiring", "expired", "cancelled"].map((v) => ({ value: v, label: t(`status.${v}`) })) }]}
      actions={canCreate && options ? <SubscriptionForm mode="create" options={{ brands: options.brands, countries: options.countries, companies: options.companies, users: options.users }} /> : undefined}
      columns={columns} rows={rows} getRowKey={(s) => s.id} getRowHref={(s) => `/subscriptions/${s.id}`}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<CreditCard className="h-5 w-5" />} title={t("subs.empty")} description={t("subs.emptyBody")} />} />
  );
}
