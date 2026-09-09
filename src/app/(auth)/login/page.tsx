import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

const DEMO_ACCOUNTS = [
  { label: "Super Admin", email: "admin@nexora.group" },
  { label: "Group Management", email: "layla.management@nexora.group" },
  { label: "Marketing Manager (Lumière · KW/AE)", email: "omar.marketing@nexora.group" },
  { label: "Regulatory (Derma · SA)", email: "sara.regulatory@nexora.group" },
  { label: "Customer Service", email: "hana.cs@nexora.group" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-lg font-bold text-on-accent shadow-md">
            N
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Welcome to NEXORA OS</h1>
          <p className="mt-1 text-[13px] text-ink-2">Sign in to your workspace</p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-md">
          <LoginForm demoAccounts={DEMO_ACCOUNTS} />
        </div>

        <p className="mt-6 text-center text-[11px] text-ink-3">
          Multi-company · Multi-brand · Permission-aware · API-first
        </p>
      </div>
    </div>
  );
}
