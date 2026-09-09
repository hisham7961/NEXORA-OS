import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { describeUserAccess } from "@/domain/permissions-admin";
import { PageHeader, Panel, PanelHeader, PanelBody, Avatar, Badge } from "@/components/ui";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const access = await describeUserAccess(user.id);

  return (
    <>
      <PageHeader title="My Profile" description="Your account, scope and what you can access." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <PanelBody className="flex flex-col items-center text-center">
            <Avatar name={user.name} color={user.avatarColor} size={64} />
            <div className="mt-3 text-[15px] font-semibold text-ink">{user.name}</div>
            <div className="text-xs text-ink-3">{user.email}</div>
            {user.title && <div className="mt-1 text-[13px] text-ink-2">{user.title}</div>}
            {user.isSuperAdmin && <Badge category="critical" className="mt-3" dot>Super Admin</Badge>}
            <dl className="mt-4 w-full space-y-1.5 text-start text-[13px]">
              <div className="flex justify-between"><dt className="text-ink-3">Language</dt><dd className="text-ink">{user.locale === "ar" ? "العربية" : "English"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Timezone</dt><dd className="text-ink">{user.timezone}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-3">Status</dt><dd className="text-ink capitalize">{user.status}</dd></div>
            </dl>
            <p className="mt-4 text-[11px] text-ink-3">Switch language and theme from the top bar.</p>
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader title="Roles &amp; scope" description="Where and what you are authorized to do." />
          <PanelBody>
            {!access || access.assignments.length === 0 ? (
              <p className="text-[13px] text-ink-3">
                {user.isSuperAdmin ? "You have full, unscoped access as Super Admin." : "You have no role assignments yet."}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-surface-2/60 text-[11px] uppercase tracking-wide text-ink-3">
                    <tr>
                      <th className="px-3 py-2 text-start">Role</th>
                      <th className="px-3 py-2 text-start">Company</th>
                      <th className="px-3 py-2 text-start">Brand</th>
                      <th className="px-3 py-2 text-start">Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {access.assignments.map((a, i) => (
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
      </div>
    </>
  );
}
