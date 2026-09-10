import type { Metadata } from "next";
import type { WhatsappCampaign } from "@prisma/client";
import { MessageCircle } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listWhatsapp, whatsappQuerySchema } from "@/domain/whatsapp";
import { getScopedOptions } from "@/domain/options";
import { getLookups, refName } from "@/domain/lookups";
import { StatusBadge, EmptyState, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { WhatsappForm } from "@/components/whatsapp/whatsapp-form";
import { BrandChip, UserChip } from "@/components/entity-chips";
import { formatDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "WhatsApp Campaigns" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function WhatsappPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("whatsapp.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = whatsappQuerySchema.parse(sp);
  const canCreate = canAnywhere(principal, "whatsapp.create");
  const [{ rows, total }, lookups, options] = await Promise.all([
    listWhatsapp(principal, query),
    getLookups(),
    canCreate ? getScopedOptions(principal, "whatsapp.create") : Promise.resolve(null),
  ]);

  const columns: Column<WhatsappCampaign>[] = [
    { key: "objective", header: t("whatsapp.col.objective"), render: (w) => w.objective ?? "—" },
    { key: "brand", header: t("common.brand"), render: (w) => <BrandChip name={refName(lookups.brands, w.brandId)} color={w.brandId ? lookups.brands.get(w.brandId)?.meta : null} /> },
    { key: "audience", header: "Audience", render: (w) => <span className="text-ink-2">{w.audience ?? "—"}</span> },
    { key: "planned", header: t("whatsapp.col.planned"), render: (w) => formatDateShort(w.plannedDate, locale) },
    { key: "responsible", header: t("whatsapp.col.responsible"), render: (w) => <UserChip name={refName(lookups.users, w.responsibleUserId)} color={w.responsibleUserId ? lookups.users.get(w.responsibleUserId)?.meta : null} /> },
    { key: "status", header: t("common.status"), render: (w) => <StatusBadge module="generic" status={w.status} /> },
  ];

  return (
    <ResourceList title={t("whatsapp.title")} description={t("whatsapp.subtitle")} countLabel={t("whatsapp.count")} savedViewsModule="whatsapp"
      searchPlaceholder={t("whatsapp.searchPlaceholder")} columns={columns} rows={rows} getRowKey={(w) => w.id} getRowHref={(w) => `/whatsapp/${w.id}`}
      actions={canCreate && options ? <WhatsappForm mode="create" options={{ brands: options.brands, countries: options.countries, users: options.users }} /> : undefined}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<MessageCircle className="h-5 w-5" />} title="No WhatsApp campaigns" description="Create a campaign, request its creative, get approval, then mark it sent and enter results." />} />
  );
}
