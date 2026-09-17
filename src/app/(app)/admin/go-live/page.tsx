import type { Metadata } from "next";
import Link from "next/link";
import { Rocket, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { pageGuard } from "@/lib/page-guard";
import { getServerI18n } from "@/lib/server-i18n";
import { AccessDenied } from "@/components/access-denied";
import { resolveAccountingCompany } from "@/domain/accounting/access";
import { companyGoLiveStatus } from "@/domain/rollout";
import { PageHeader, Panel, PanelBody, Badge } from "@/components/ui";
import { CompanyPicker } from "@/components/accounting/company-picker";

export const metadata: Metadata = { title: "Go-Live Checklist" };

export default async function GoLivePage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const { principal, locale, denied } = await pageGuard("settings.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { t } = await getServerI18n();
  const sp = await searchParams;
  const { companies, current } = await resolveAccountingCompany(principal, sp.company);
  if (!current) return <AccessDenied locale={locale} />;
  const report = await companyGoLiveStatus(principal, current.id);

  return (
    <>
      <PageHeader
        title={t("admin.goLive")}
        description={t("admin.goLiveSub", { name: current.name })}
        actions={<div className="flex items-center gap-2">
          <CompanyPicker companies={companies} current={current.id} />
          {report.ready ? <Badge category="success">{t("admin.readyForGoLive")}</Badge> : <Badge category="warning">{t("admin.doneCount", { done: report.done, total: report.total })}</Badge>}
        </div>}
      />
      <Panel>
        <PanelBody className="p-0">
          <ul className="divide-y divide-line">
            {report.items.map((it) => (
              <li key={it.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  {it.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-ink">{it.label}{!it.required && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-3">{t("admin.optional")}</span>}</div>
                    <div className="text-[12px] text-ink-3">{it.hint}</div>
                  </div>
                </div>
                {it.href && !it.done && (
                  <Link href={`${it.href}?company=${current.id}`} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line-strong px-2.5 py-1 text-[12px] text-accent hover:bg-surface-2">
                    {t("admin.setUp")} <ArrowRight className="h-3.5 w-3.5 flip-x" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </PanelBody>
      </Panel>
      {report.ready && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-success"><Rocket className="h-4 w-4" /> {t("admin.companyReady", { name: current.name })}</p>
      )}
    </>
  );
}
