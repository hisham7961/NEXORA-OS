import type { Metadata } from "next";
import type { Document } from "@prisma/client";
import { Award } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getCertificatesView, getDocumentTypeNames, documentQuerySchema } from "@/domain/documents";
import { getLookups, refName } from "@/domain/lookups";
import { StatusBadge, EmptyState, type Column } from "@/components/ui";
import { ResourceList } from "@/components/list/resource-list";
import { BrandChip } from "@/components/entity-chips";
import { formatDate } from "@/lib/format";
import { daysUntil } from "@/lib/utils";

export const metadata: Metadata = { title: "Certificates" };
import { getServerI18n } from "@/lib/server-i18n";

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("documents.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const query = documentQuerySchema.parse(sp);
  const [{ rows, total }, lookups, typeNames] = await Promise.all([getCertificatesView(principal, query), getLookups(), getDocumentTypeNames()]);

  const columns: Column<Document>[] = [
    { key: "title", header: t("certs.col.certificate"), render: (d) => d.title },
    { key: "type", header: t("common.type"), render: (d) => (d.documentTypeId ? typeNames.get(d.documentTypeId) ?? "—" : "—") },
    { key: "brand", header: t("common.brand"), render: (d) => <BrandChip name={refName(lookups.brands, d.brandId)} color={d.brandId ? lookups.brands.get(d.brandId)?.meta : null} /> },
    { key: "expiry", header: t("documents.col.expiry"), render: (d) => { const days = daysUntil(d.expiryDate); return <span className={days !== null && days < 30 ? "font-medium text-critical tabular" : "text-ink tabular"}>{formatDate(d.expiryDate, locale)}</span>; } },
    { key: "status", header: t("common.status"), align: "end", render: (d) => <StatusBadge module="document" status={d.status} /> },
  ];

  return (
    <ResourceList title={t("certs.title")} description={t("certs.subtitle")} countLabel={t("certs.count")} savedViewsModule="certificates"
      searchPlaceholder={t("certs.searchPlaceholder")}
      columns={columns} rows={rows} getRowKey={(d) => d.id}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<Award className="h-5 w-5" />} title="No certificates" description="Regulatory certificates and their expiry dates appear here." />} />
  );
}
