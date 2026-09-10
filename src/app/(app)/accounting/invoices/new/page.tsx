import type { Metadata } from "next";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listCustomers } from "@/domain/accounting/customers";
import { listTaxRates } from "@/domain/accounting/setup";
import { PageHeader, Panel, PanelBody, EmptyState } from "@/components/ui";
import { DocumentComposer } from "@/components/accounting/ar-controls";

export const metadata: Metadata = { title: "New Invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("ar.create");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title={t("acct.newInvoice")} /><Panel><EmptyState title={t("acct.noCompany")} /></Panel></>;

  const [{ rows: customers }, taxRates] = await Promise.all([
    listCustomers(principal, current.id, { active: "active", pageSize: 500 }),
    listTaxRates(principal, current.id),
  ]);

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/invoices?company=${current.id}`} className="hover:text-ink-2">{t("acct.invoices")}</Link> / {t("acct.newCrumb")}</div>
      <PageHeader title={t("acct.newInvoice")} description={`Legal company ${current.name} · ${current.baseCurrency}`} />
      <Panel>
        <PanelBody>
          <DocumentComposer companyId={current.id} kind="invoice" baseCurrency={current.baseCurrency}
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            taxRates={taxRates.map((t) => ({ id: t.id, name: `${t.name} (${Number(t.rate)}%)`, rate: Number(t.rate) }))} />
        </PanelBody>
      </Panel>
    </>
  );
}
