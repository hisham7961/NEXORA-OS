import type { Metadata } from "next";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listCustomers } from "@/domain/accounting/customers";
import { listTaxRates } from "@/domain/accounting/setup";
import { PageHeader, Panel, PanelBody, EmptyState } from "@/components/ui";
import { DocumentComposer } from "@/components/accounting/ar-controls";

export const metadata: Metadata = { title: "New Credit Note" };

export default async function NewCreditNotePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("ar.create");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const { current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title="New Credit Note" /><Panel><EmptyState title="No company in scope" /></Panel></>;

  const [{ rows: customers }, taxRates] = await Promise.all([
    listCustomers(principal, current.id, { active: "active", pageSize: 500 }),
    listTaxRates(principal, current.id),
  ]);

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/credit-notes?company=${current.id}`} className="hover:text-ink-2">Credit Notes</Link> / New</div>
      <PageHeader title="New Credit Note" description={`Legal company ${current.name} · ${current.baseCurrency}`} />
      <Panel>
        <PanelBody>
          <DocumentComposer companyId={current.id} kind="credit_note" baseCurrency={current.baseCurrency}
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            taxRates={taxRates.map((t) => ({ id: t.id, name: `${t.name} (${Number(t.rate)}%)`, rate: Number(t.rate) }))} />
        </PanelBody>
      </Panel>
    </>
  );
}
