import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/current-user";
import { getServerI18n } from "@/lib/server-i18n";
import { canAnywhere } from "@/lib/permissions/engine";

/**
 * Standard server-page guard. Ensures an authenticated principal (the (app)
 * layout already redirects, this is defense-in-depth) and reports whether the
 * user may see a module at all. Page-level module visibility is a convenience;
 * the service layer still enforces per-record scope.
 */
export async function pageGuard(permission?: string) {
  const principal = await getPrincipal();
  if (!principal) redirect("/login");
  const { locale, dir, t } = await getServerI18n();
  const denied = permission ? !canAnywhere(principal, permission) : false;
  return { principal, locale, dir, t, denied };
}
