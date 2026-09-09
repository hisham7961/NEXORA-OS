"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit/log";
import { rateLimit } from "@/lib/ratelimit";
import { isLocale } from "@/i18n";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface AuthState {
  error?: string;
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: String(formData.get("email") ?? "").toLowerCase().trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "invalid" };

  // Brute-force protection (§1): throttle by IP + email before touching the DB.
  const h0 = await headers();
  const ip0 = h0.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await rateLimit("auth_login", `${ip0}:${parsed.data.email}`);
  if (!rl.allowed) {
    await writeAudit({ actorId: null, action: "auth.rate_limited", entityType: "User", summary: `login throttled for ${parsed.data.email}` }).catch(() => {});
    return { error: "rate_limited" };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const valid =
    user && user.status === "active" && !user.archivedAt
      ? await verifyPassword(parsed.data.password, user.passwordHash)
      : false;

  if (!user || !valid) {
    return { error: "invalid" };
  }

  const hdrs = await headers();
  await createSession(user.id, {
    userAgent: hdrs.get("user-agent"),
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const store = await cookies();
  store.set("nexora_locale", user.locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  await writeAudit({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id });

  redirect("/");
}

export async function signOutAction() {
  await destroySession();
  redirect("/login");
}

export async function setLocaleAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en");
  if (isLocale(locale)) {
    const store = await cookies();
    store.set("nexora_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
}
