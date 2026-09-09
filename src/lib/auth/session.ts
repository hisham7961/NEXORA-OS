import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "nexora_session";
const SESSION_TTL_DAYS = 30;

/** Store only an HMAC of the token so a DB leak never yields a usable session. */
function hashToken(token: string): string {
  return createHmac("sha256", env.sessionSecret).update(token).digest("hex");
}

export interface SessionContext {
  userAgent?: string | null;
  ip?: string | null;
}

/** Create a session row and set the httpOnly cookie. Returns the raw token. */
export async function createSession(userId: string, ctx: SessionContext = {}): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent: ctx.userAgent ?? null,
      ip: ctx.ip ?? null,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    expires: expiresAt,
  });

  return token;
}

/** Resolve the current session's userId from the cookie, or null. */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return session.userId;
}

/** Revoke the current session and clear the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  store.delete(SESSION_COOKIE);
}
