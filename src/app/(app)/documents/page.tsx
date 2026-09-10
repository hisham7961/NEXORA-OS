import type { Metadata } from "next";
import type { Document } from "@prisma/client";
import { FileText } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { listDocuments, getDocumentTypeNames, documentQuerySchema } from "@/domain/documents";
import { getLookups, refName } from "@/domain/lookups";
import { StatusBadge, EmptyState, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { CountryChip } from "@/components/entity-chips";
import { formatDate } from "@/lib/format";
import { daysUntil } from "@/lib/utils";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("documents.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = documentQuerySchema.parse(sp);
  const [{ rows, total }, lookups, typeNames] = await Promise.all([listDocuments(principal, query), getLookups(), getDocumentTypeNames()]);

  const columns: Column<Document>[] = [
    { key: "title", header: t("documents.col.document"), render: (d) => d.title },
    { key: "type", header: t("common.type"), render: (d) => (d.documentTypeId ? typeNames.get(d.documentTypeId) ?? "—" : "—") },
    { key: "country", header: t("common.market"), render: (d) => <CountryChip name={refName(lookups.countries, d.countryId)} iso2={d.countryId ? lookups.countries.get(d.countryId)?.meta : null} /> },
    { key: "expiry", header: t("documents.col.expiry"), align: "end", render: (d) => { const days = daysUntil(d.expiryDate); return <span className={days !== null && days < 30 ? "text-critical tabular" : "text-ink-3 tabular"}>{formatDate(d.expiryDate, locale)}{days !== null && days >= 0 && days < 60 ? ` · ${days}d` : ""}</span>; } },
    { key: "status", header: t("common.status"), render: (d) => <StatusBadge module="document" status={d.status} /> },
  ];

  return (
    <ResourceList title={t("documents.title")} description={t("documents.subtitle")} countLabel={t("documents.count")} savedViewsModule="documents"
      searchPlaceholder={t("documents.searchPlaceholder")}
      filters={[{ name: "status", label: t("common.status"), options: ["valid", "expiring", "expired", "renewal_started", "replaced", "archived"].map((v) => ({ value: v, label: t(`status.${v}`) })) }]}
      columns={columns} rows={rows} getRowKey={(d) => d.id}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<FileText className="h-5 w-5" />} title={t("documents.empty")} description={t("documents.emptyBody")} />} />
  );
}
