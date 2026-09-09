import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { canAnywhere } from "@/lib/permissions/engine";
import { listChannels } from "@/domain/discussions";
import { getScopedOptions } from "@/domain/options";
import { ChannelSidebar } from "@/components/discussions/channel-sidebar";
import { NewChannelButton } from "@/components/discussions/new-channel";

export default async function DiscussionsLayout({ children }: { children: React.ReactNode }) {
  const { principal, locale, denied } = await pageGuard("discussions.view");
  if (denied) return <AccessDenied locale={locale} />;
  const canCreate = canAnywhere(principal, "discussions.create");
  const [channels, options] = await Promise.all([
    listChannels(principal),
    canCreate ? getScopedOptions(principal, "discussions.create") : Promise.resolve(null),
  ]);

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 overflow-hidden rounded-xl border border-line bg-surface">
      <div className="w-60 shrink-0 border-e border-line bg-surface-2/30">
        <ChannelSidebar
          channels={channels.map((c) => ({ id: c.id, name: c.name, type: c.type, isPrivate: c.isPrivate, unread: c.unread }))}
          action={canCreate && options ? <NewChannelButton options={{ brands: options.brands, countries: options.countries, companies: options.companies }} /> : undefined}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
