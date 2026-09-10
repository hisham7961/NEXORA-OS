import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { listOpeningAccounts, openingBalancesStatus } from "@/domain/accounting/opening-balances";
import { PageHeader, Panel, PanelBody } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";
import { OpeningBalancesForm } from "@/components/accounting/opening-balances-form";

export const metadata: Metadata = { title: "Opening Balances" };

export default async function OpeningBalancesPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const { principal, locale, denied } = await pageGuard("accounting.post");
  if (denied) return <AccessDenied locale={locale} />;
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <AccessDenied locale={locale} />;

  const [accounts, status] = await Promise.all([
    listOpeningAccounts(principal, current.id),
    openingBalancesStatus(principal, current.id),
  ]);

  return (
    <>
      <PageHeader
        title="Opening Balances"
        description={`Carry ${current.name}'s existing account balances into the ledger at go-live. Entered once, posted as a single balanced opening journal in ${current.baseCurrency}.`}
        actions={<CompanyPicker companies={companies} current={current.id} />}
      />
      <Panel>
        <PanelBody>
          <OpeningBalancesForm
            companyId={current.id}
            accounts={accounts}
            baseCurrency={current.baseCurrency}
            alreadyPosted={{ posted: status.posted, entryId: status.entryId, postedAt: status.postedAt ? status.postedAt.toISOString() : null }}
          />
        </PanelBody>
      </Panel>
    </>
  );
}
