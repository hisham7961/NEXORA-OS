import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { pageGuard } from "@/lib/page-guard";
import { AccessDenied } from "@/components/access-denied";
import { getUserAdmin } from "@/domain/users-admin";
import { getActivity } from "@/domain/mutation";
import { getLookups, refName } from "@/domain/lookups";
import { Panel, PanelHeader, PanelBody, Avatar, Badge } from "@/components/ui";
import { ActivityTimeline, type TimelineEntry } from "@/components/activity-timeline";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "User" };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { locale, denied } = await pageGuard("users.view");
  if (denied) return <AccessDenied locale={locale} />;
  const { id } = await params;
  const data = await getUserAdmin(id);
  if (!data) notFound();
  const { user, assignments } = data;
  const [activity, lookups] = await Promise.all([getActivity("User", id), getLookups()]);
  const timeline: TimelineEntry[] = activity.map((a) => ({
    id: a.id, at: a.at, actorName: a.actorId ? refName(lookups.users, a.actorId) : "System",
    actorColor: a.actorId ? lookups.users.get(a.actorId)?.meta : null, action: a.action, summary: a.summary,
  }));

  return (
    <>
      <div className="mb-1 text-xs text-ink-3"><Link href="/admin/users" className="hover:text-ink-2">Users</Link> / {user.name}</div>
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={user.name} color={user.avatarColor} size={44} />
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">{user.name}</h1>
          <div className="text-xs text-ink-3">{user.email}{user.title ? ` · ${user.title}` : ""}</div>
        </div>
        {user.isSuperAdmin && <Badge category="critical" dot>Super Admin</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Role assignments &amp; scope" description="Access is granted per role within a scope (§3)." />
          <PanelBody>
            {assignments.length === 0 ? (
              <p className="text-[13px] text-ink-3">{user.isSuperAdmin ? "Full unscoped access as Super Admin." : "No role assignments."}</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-surface-2/60 text-[11px] uppercase tracking-wide text-ink-3">
                    <tr><th className="px-3 py-2 text-start">Role</th><th className="px-3 py-2 text-start">Company</th><th className="px-3 py-2 text-start">Brand</th><th className="px-3 py-2 text-start">Country</th></tr>
                  </thead>
                  <tbody>
                    {assignments.map((a, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="px-3 py-2 font-medium text-ink">{a.roleName}</td>
                        <td className="px-3 py-2 text-ink-2">{a.company}</td>
                        <td className="px-3 py-2 text-ink-2">{a.brand}</td>
                        <td className="px-3 py-2 text-ink-2">{a.country}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="Account" />
          <PanelBody>
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex justify-between"><dt className="text-ink-3">Status</dt><dd className="capitalize text-ink">{user.status}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Language</dt><dd className="text-ink">{user.locale === "ar" ? "العربية" : "English"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Timezone</dt><dd className="text-ink">{user.timezone}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Last login</dt><dd className="text-ink">{formatDate(user.lastLoginAt, locale)}</dd></div>
              {user.employee && <div className="flex justify-between"><dt className="text-ink-3">Joined</dt><dd className="text-ink">{formatDate(user.employee.joinDate, locale)}</dd></div>}
            </dl>
          </PanelBody>
        </Panel>
        <Panel className="lg:col-span-3">
          <PanelHeader title="Activity" description="Role assignment and permission changes (§28, §31)." />
          <PanelBody><ActivityTimeline entries={timeline} locale={locale} empty="No permission changes recorded." /></PanelBody>
        </Panel>
      </div>
    </>
  );
}
