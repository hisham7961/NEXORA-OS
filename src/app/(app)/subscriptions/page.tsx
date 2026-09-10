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

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("subscriptions.view");
  if (denied) return <AccessDenied locale={locale} />;
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
    { key: "provider", header: "Provider", render: (s) => s.provider },
    { key: "company", header: "Company", render: (s) => refName(lookups.companies, s.companyId) },
    { key: "plan", header: "Plan", render: (s) => s.plan ?? "—" },
    { key: "cost", header: "Cost", align: "end", render: (s) => (showValues ? formatCurrency(s.cost, s.currency, locale) : "—") },
    { key: "cycle", header: "Cycle", render: (s) => <span className="capitalize text-ink-3">{s.billingCycle}</span> },
    { key: "renewal", header: "Renews", align: "end", render: (s) => { const d = daysUntil(s.renewalDate); return <span className={d !== null && d < 14 ? "text-critical tabular" : "text-ink-3 tabular"}>{formatDate(s.renewalDate, locale)}</span>; } },
    { key: "status", header: "Status", render: (s) => <StatusBadge module="subscription" status={s.status} /> },
  ];

  return (
    <ResourceList title="Subscriptions & Services" description="SaaS, domains, hosting and tools — with renewal alerts." countLabel="subscriptions" savedViewsModule="subscriptions"
      searchPlaceholder="Search providers…"
      filters={[{ name: "status", label: "Status", options: ["active", "expiring", "expired", "cancelled"].map((v) => ({ value: v, label: v })) }]}
      actions={canCreate && options ? <SubscriptionForm mode="create" options={{ brands: options.brands, countries: options.countries, companies: options.companies, users: options.users }} /> : undefined}
      columns={columns} rows={rows} getRowKey={(s) => s.id} getRowHref={(s) => `/subscriptions/${s.id}`}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<CreditCard className="h-5 w-5" />} title="No subscriptions" description="Track recurring services and their renewal dates to avoid surprise lapses." />} />
  );
}
