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

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("documents.view");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const query = documentQuerySchema.parse(sp);
  const [{ rows, total }, lookups, typeNames] = await Promise.all([listDocuments(principal, query), getLookups(), getDocumentTypeNames()]);

  const columns: Column<Document>[] = [
    { key: "title", header: "Document", render: (d) => d.title },
    { key: "type", header: "Type", render: (d) => (d.documentTypeId ? typeNames.get(d.documentTypeId) ?? "—" : "—") },
    { key: "country", header: "Market", render: (d) => <CountryChip name={refName(lookups.countries, d.countryId)} iso2={d.countryId ? lookups.countries.get(d.countryId)?.meta : null} /> },
    { key: "expiry", header: "Expiry", align: "end", render: (d) => { const days = daysUntil(d.expiryDate); return <span className={days !== null && days < 30 ? "text-critical tabular" : "text-ink-3 tabular"}>{formatDate(d.expiryDate, locale)}{days !== null && days >= 0 && days < 60 ? ` · ${days}d` : ""}</span>; } },
    { key: "status", header: "Status", render: (d) => <StatusBadge module="document" status={d.status} /> },
  ];

  return (
    <ResourceList title="Documents" description="Official documents with expiration tracking and configurable reminders." countLabel="documents"
      searchPlaceholder="Search documents…"
      filters={[{ name: "status", label: "Status", options: ["valid", "expiring", "expired", "renewal_started", "replaced", "archived"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })) }]}
      columns={columns} rows={rows} getRowKey={(d) => d.id}
      page={query.page} pageSize={query.pageSize} total={total} params={sp}
      empty={<EmptyState icon={<FileText className="h-5 w-5" />} title="No documents" description="Certificates, licenses and authorizations with expiry live here." />} />
  );
}
