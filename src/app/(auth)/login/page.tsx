import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LoginForm } from "@/components/auth/login-form";
import { getServerI18n } from "@/lib/server-i18n";

export const metadata: Metadata = { title: "Sign in" };

const DEMO_ACCOUNTS = [
  { labelKey: "auth.roleSuperAdmin", email: "admin@nexora.group" },
  { labelKey: "auth.roleGroupMgmt", email: "layla.management@nexora.group" },
  { labelKey: "auth.roleMktMgr", email: "omar.marketing@nexora.group" },
  { labelKey: "auth.roleRegulatory", email: "sara.regulatory@nexora.group" },
  { labelKey: "auth.roleCS", email: "hana.cs@nexora.group" },
] as const;

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const { t } = await getServerI18n();

  // Demo accounts + prefilled credentials only in an explicitly-enabled demo
  // build (§38) — never in production, where the login form is empty.
  const demoAccounts = process.env.NEXORA_DEMO_LOGIN === "1"
    ? DEMO_ACCOUNTS.map((a) => ({ label: t(a.labelKey), email: a.email }))
    : [];

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-lg font-bold text-on-accent shadow-md">
            N
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{t("auth.welcome")}</h1>
          <p className="mt-1 text-[13px] text-ink-2">{t("auth.signInWorkspace")}</p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-md">
          <LoginForm demoAccounts={demoAccounts} />
        </div>

        <p className="mt-6 text-center text-[11px] text-ink-3">
          {t("auth.tagline")}
        </p>
      </div>
    </div>
  );
}
