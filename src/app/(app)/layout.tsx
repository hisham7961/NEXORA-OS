import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser, getPrincipal } from "@/lib/auth/current-user";
import { mfaRequiredFor, isMfaEnabled } from "@/domain/mfa";
import { allowedNavKeys, allowedCreateCommands } from "@/lib/navigation-access";
import { DEFAULT_ROLES } from "@/lib/permissions/catalog";
import { prisma } from "@/lib/db";
import { ShellProvider } from "@/components/layout/shell-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, principal] = await Promise.all([getCurrentUser(), getPrincipal()]);
  if (!user || !principal) redirect("/login");

  // Mandatory-MFA policy enforcement (audit SEC-02). A user covered by
  // security.mfaRequiredForAdmins/Finance who has not enrolled is forced to the MFA
  // setup page before reaching anything else. The enrollment page (and its API) are
  // exempt so the requirement is satisfiable rather than a lock-out loop.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const onEnrollmentPage = pathname === "/settings/profile" || pathname.startsWith("/settings/profile/");
  if (!onEnrollmentPage) {
    const [required, enrolled] = await Promise.all([mfaRequiredFor(principal), isMfaEnabled(user.id)]);
    if (required && !enrolled) redirect("/settings/profile?mfa=required");
  }

  const allowed = allowedNavKeys(principal);
  const createCommands = allowedCreateCommands(principal);

  let roleLabel = "Employee";
  if (principal.isSuperAdmin) roleLabel = "Super Administrator";
  else if (principal.assignments[0]) {
    const def = DEFAULT_ROLES.find((r) => r.key === principal.assignments[0].roleKey);
    roleLabel = def?.name ?? principal.assignments[0].roleKey;
  }

  const unread = await prisma.notification.count({
    where: { userId: user.id, state: "unread" },
  });

  return (
    <ShellProvider>
      <div className="flex h-dvh overflow-hidden bg-bg">
        <Sidebar allowed={allowed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            user={{ name: user.name, email: user.email, avatarColor: user.avatarColor, roleLabel }}
            unread={unread}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 animate-fade-in">{children}</div>
          </main>
        </div>
      </div>
      <CommandPalette allowed={allowed} createCommands={createCommands} />
    </ShellProvider>
  );
}
