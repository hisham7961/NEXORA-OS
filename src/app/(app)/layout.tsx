import { redirect } from "next/navigation";
import { getCurrentUser, getPrincipal } from "@/lib/auth/current-user";
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
