import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getSettingsGrouped } from "@/domain/platform";
import { PageHeader, Panel, PanelHeader, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { locale, denied } = await pageGuard("settings.view");
  if (denied) return <AccessDenied locale={locale} />;
  void locale;
  const groups = await getSettingsGrouped();

  return (
    <>
      <PageHeader title="System Settings" description="Operational configuration visible to authorized administrators (§36)." />
      {groups.length === 0 ? (
        <Panel><EmptyState title="No settings configured" description="Master data, currencies, workflows and notification rules are managed here." /></Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <Panel key={g.category}>
              <PanelHeader title={<span className="capitalize">{g.category}</span>} />
              <ul className="divide-y divide-line">
                {g.items.map((it) => (
                  <li key={it.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="font-mono text-[12px] text-ink-2">{it.key}</span>
                    <code className="max-w-[60%] truncate rounded bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-ink">{it.value}</code>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
