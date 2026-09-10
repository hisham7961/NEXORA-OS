import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { Principal } from "@/lib/permissions/engine";
import { loadPrincipal } from "@/lib/permissions/load";
import { audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";

/**
 * API token lifecycle + bearer authentication (§32). Personal access tokens let
 * non-browser clients (the future mobile app, integrations) call /api/v1 without a
 * session cookie. A token authenticates AS its owning user and carries that user's
 * permissions and scope — every request still goes through the same permission
 * engine — with two hard limits enforced here: expiry/revocation, and an optional
 * read-only flag that blocks all non-GET requests. Only the token's HMAC is stored;
 * the raw value is shown once at creation and is unrecoverable thereafter.
 */
export const TOKEN_PREFIX = "nxo_";

/** Deterministic HMAC of a raw token — the only form persisted (mirrors sessions). */
function hashToken(raw: string): string {
  return createHmac("sha256", env.sessionSecret).update(raw).digest("hex");
}

interface TokenScopes { readOnly: boolean }
function parseScopes(json: string | null): TokenScopes {
  if (!json) return { readOnly: false };
  try { const v = JSON.parse(json) as Partial<TokenScopes>; return { readOnly: !!v.readOnly }; }
  catch { return { readOnly: false }; }
}

export interface AuthedToken { principal: Principal; user: User; tokenId: string; readOnly: boolean }

/**
 * Verify a raw bearer token. Returns the authenticated principal or null (unknown,
 * revoked, expired, or the user is gone/inactive). Refreshes lastUsedAt at most
 * once a minute to avoid a write on every request.
 */
export async function authenticateApiToken(raw: string): Promise<AuthedToken | null> {
  if (!raw || !raw.startsWith(TOKEN_PREFIX)) return null;
  const token = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!token || !token.userId) return null;
  if (token.revokedAt) return null;
  if (token.expiresAt && token.expiresAt.getTime() <= Date.now()) return null;

  const user = await prisma.user.findUnique({ where: { id: token.userId } });
  if (!user || user.archivedAt || user.status !== "active") return null;
  const principal = await loadPrincipal(user.id);
  if (!principal) return null;

  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 60_000) {
    await prisma.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return { principal, user, tokenId: token.id, readOnly: parseScopes(token.scopesJson).readOnly };
}

// --- Lifecycle (owner-managed) ------------------------------------------------

export const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  readOnly: z.coerce.boolean().default(false),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

export async function listApiTokens(principal: Principal) {
  const rows = await prisma.apiToken.findMany({
    where: { userId: principal.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, scopesJson: true, lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true },
  });
  return rows.map((t) => ({
    id: t.id, name: t.name, prefix: t.prefix, readOnly: parseScopes(t.scopesJson).readOnly,
    lastUsedAt: t.lastUsedAt, expiresAt: t.expiresAt, createdAt: t.createdAt,
    status: (t.revokedAt ? "revoked" : t.expiresAt && t.expiresAt.getTime() <= Date.now() ? "expired" : "active") as "active" | "revoked" | "expired",
  }));
}

/** Create a token for the caller. Returns the raw token ONCE — never stored in clear. */
export async function createApiToken(ctx: ActorContext, raw: unknown): Promise<{ id: string; token: string; name: string }> {
  const input = createTokenSchema.parse(raw);
  const secret = randomBytes(24).toString("base64url");
  const token = `${TOKEN_PREFIX}${secret}`;
  const prefix = `${TOKEN_PREFIX}${secret.slice(0, 6)}`;
  const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null;
  const row = await prisma.apiToken.create({
    data: {
      name: input.name, userId: ctx.principal.userId, tokenHash: hashToken(token), prefix,
      scopesJson: JSON.stringify({ readOnly: input.readOnly }), expiresAt,
    },
  });
  await audit(ctx, { action: "api_token.created", entityType: "ApiToken", entityId: row.id, summary: `Created API token "${input.name}"${input.readOnly ? " (read-only)" : ""}` });
  return { id: row.id, token, name: input.name };
}

export async function revokeApiToken(ctx: ActorContext, id: string): Promise<void> {
  const token = await prisma.apiToken.findUnique({ where: { id } });
  if (!token || token.userId !== ctx.principal.userId) throw new ServiceError("not_found", "Token not found", 404);
  if (token.revokedAt) return;
  await prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit(ctx, { action: "api_token.revoked", entityType: "ApiToken", entityId: id, summary: `Revoked API token "${token.name}"` });
}
