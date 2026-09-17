import Link from "next/link";
import { ChevronRight, CircleCheck, Activity, Gauge } from "lucide-react";
import type { Metadata } from "next";
import { requirePrincipal } from "@/lib/auth/current-user";
import { getServerI18n } from "@/lib/server-i18n";
import { getCommandCenter, type AttentionCard } from "@/domain/command-center";
import { Panel, PanelHeader, PanelBody, PageHeader, EmptyState, Metric } from "@/components/ui";

export const metadata: Metadata = { title: "Command Center" };

const TONE_CHIP: Record<AttentionCard["tone"], string> = {
  critical: "bg-critical-soft text-critical",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
};
const TONE_DOT: Record<AttentionCard["tone"], string> = {
  critical: "bg-critical",
  warning: "bg-warning",
  info: "bg-info",
};

export default async function CommandCenterPage() {
  const principal = await requirePrincipal();
  const { t } = await getServerI18n();
  const { attention, liveOps, pulse } = await getCommandCenter(principal);

  const totalAttention = attention.reduce((sum, a) => sum + a.count, 0);

  return (
    <>
      <PageHeader
        title={t("cc.title")}
        description={t("home.subtitle")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Needs Attention — the operational heart (§5) */}
        <div className="lg:col-span-2">
          <Panel>
            <PanelHeader
              title={t("cc.needsAttention")}
              icon={<Gauge className="h-4 w-4" />}
              action={
                totalAttention > 0 ? (
                  <span className="rounded-full bg-critical-soft px-2 py-0.5 text-xs font-semibold text-critical tabular">
                    {totalAttention}
                  </span>
                ) : null
              }
            />
            {attention.length === 0 ? (
              <EmptyState
                icon={<CircleCheck className="h-5 w-5 text-success" />}
                title={t("cc.allClear")}
                description={t("home.emptyBody")}
              />
            ) : (
              <ul className="divide-y divide-line">
                {attention.map((card) => (
                  <li key={card.id}>
                    <Link
                      href={card.href}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[card.tone]}`} />
                      <span className="flex-1 text-[13px] text-ink">{card.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular ${TONE_CHIP[card.tone]}`}>
                        {card.count}
                      </span>
                      <ChevronRight className="h-4 w-4 text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Live Operations + Pulse */}
        <div className="space-y-4">
          <Panel>
            <PanelHeader title={t("cc.liveOps")} icon={<Activity className="h-4 w-4" />} />
            <ul className="divide-y divide-line">
              {liveOps.map((s) => (
                <li key={s.id}>
                  <Link href={s.href} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2">
                    <span className="text-[13px] text-ink-2">{s.label}</span>
                    <span className="text-[15px] font-semibold text-ink tabular">{s.value}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          {pulse.length > 0 && (
            <Panel>
              <PanelHeader title={t("cc.pulse")} />
              <PanelBody className="grid grid-cols-2 gap-4">
                {pulse.map((p) => (
                  <Metric key={p.id} label={p.label} value={p.value} sub={p.sub} />
                ))}
              </PanelBody>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
