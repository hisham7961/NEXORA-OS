import type { Metadata } from "next";
import Link from "next/link";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listSuppliers } from "@/domain/accounting/suppliers";
import { listTaxRates } from "@/domain/accounting/setup";
import { prisma } from "@/lib/db";
import { PageHeader, Panel, PanelBody, EmptyState } from "@/components/ui";
import { BillComposer } from "@/components/accounting/ap-controls";

export const metadata: Metadata = { title: "New Bill" };

export default async function NewBillPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { principal, locale, denied } = await pageGuard("ap.create");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <><PageHeader title={t("acct.newBill")} /><Panel><EmptyState title={t("acct.noCompany")} /></Panel></>;

  const [{ rows: suppliers }, taxRates, accounts] = await Promise.all([
    listSuppliers(principal, current.id, { active: "active", pageSize: 500 }),
    listTaxRates(principal, current.id),
    prisma.account.findMany({ where: { companyId: current.id, isActive: true, allowPosting: true, archivedAt: null, type: { in: ["expense", "cogs", "other_expense", "asset"] } }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href={`/accounting/bills?company=${current.id}`} className="hover:text-ink-2">{t("acct.bills")}</Link> / {t("acct.newCrumb")}</div>
      <PageHeader title={t("acct.newBill")} description={`Legal company ${current.name} · ${current.baseCurrency}`} />
      <Panel>
        <PanelBody>
          <BillComposer companyId={current.id} kind="bill" baseCurrency={current.baseCurrency}
            suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
            taxRates={taxRates.map((t) => ({ id: t.id, name: `${t.name} (${Number(t.rate)}%)`, rate: Number(t.rate) }))}
            accounts={accounts.map((a) => ({ id: a.id, label: `${a.code} ${a.name}` }))} />
        </PanelBody>
      </Panel>
    </>
  );
}
