import { prisma } from "@/lib/db";
import { allPermissionKeys } from "@/lib/permissions/catalog";

/**
 * Feature-registry reconciliation + OpenAPI generation (§33-35). The developer
 * portal's feature/endpoint list is seed-declared and can silently drift from
 * reality. reconcileFeatures() validates each declared feature against the real
 * permission catalog and its own endpoint declaration, surfacing drift instead of
 * letting it rot. generateOpenApi() emits a machine-readable contract for the
 * declared /api/v1 surface plus the always-on endpoints, so a non-browser client
 * has a real spec to build against.
 */

export interface FeatureIssue { key: string; name: string; problem: string }
export interface ReconcileReport { total: number; ok: number; issues: FeatureIssue[] }

/** Always-available endpoints not tied to a feature-registry row. */
const CORE_ENDPOINTS: { path: string; method: string; summary: string; auth: boolean; permission?: string }[] = [
  { path: "/health", method: "get", summary: "Readiness probe (DB, storage, scheduler)", auth: false },
  { path: "/health/live", method: "get", summary: "Liveness probe", auth: false },
  { path: "/search", method: "get", summary: "Universal search across permitted entities", auth: true },
  { path: "/openapi.json", method: "get", summary: "This API contract", auth: true },
];

export async function reconcileFeatures(): Promise<ReconcileReport> {
  const [features, validKeys] = await Promise.all([
    prisma.featureRegistry.findMany({ orderBy: { module: "asc" } }),
    Promise.resolve(new Set([...allPermissionKeys(), "*"])),
  ]);
  const issues: FeatureIssue[] = [];
  for (const f of features) {
    if (f.permissionKey && !validKeys.has(f.permissionKey)) {
      issues.push({ key: f.key, name: f.name, problem: `references unknown permission "${f.permissionKey}"` });
    }
    if (f.mobileApiAvailable && !f.endpoint) {
      issues.push({ key: f.key, name: f.name, problem: "declared on the mobile API but has no endpoint" });
    }
    if (f.endpoint && !f.endpoint.startsWith("/api/v1/")) {
      issues.push({ key: f.key, name: f.name, problem: `endpoint "${f.endpoint}" is not under /api/v1` });
    }
  }
  return { total: features.length, ok: features.length - issues.length, issues };
}

interface OpenApiDoc { openapi: string; info: object; servers: object[]; components: object; security: object[]; paths: Record<string, unknown> }

export async function generateOpenApi(): Promise<OpenApiDoc> {
  const features = await prisma.featureRegistry.findMany({ where: { endpoint: { not: null } }, orderBy: { module: "asc" } });
  const paths: Record<string, Record<string, unknown>> = {};

  const add = (rawPath: string, method: string, opts: { summary: string; tag?: string; auth: boolean; permission?: string | null }) => {
    const rel = rawPath.replace(/^\/api\/v1/, "") || "/";
    (paths[rel] ??= {})[method] = {
      summary: opts.summary,
      tags: [opts.tag ?? "core"],
      ...(opts.permission ? { description: `Requires permission \`${opts.permission}\`.` } : {}),
      security: opts.auth ? [{ bearerAuth: [] }, { cookieAuth: [] }] : [],
      responses: { "200": { description: "OK" }, ...(opts.auth ? { "401": { description: "Authentication required" }, "403": { description: "Forbidden" } } : {}) },
    };
  };

  for (const c of CORE_ENDPOINTS) add(`/api/v1${c.path}`, c.method, { summary: c.summary, tag: "core", auth: c.auth });
  for (const f of features) add(f.endpoint!, "get", { summary: f.name, tag: f.module, auth: true, permission: f.permissionKey });

  return {
    openapi: "3.1.0",
    info: { title: "NEXORA OS API", version: "v1", description: "Versioned REST API. Authenticate with a Bearer API token or the session cookie; every endpoint enforces the same permission engine and scope as the web app." },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "A personal API token (Authorization: Bearer nxo_…)." },
        cookieAuth: { type: "apiKey", in: "cookie", name: "nexora_session" },
      },
    },
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    paths,
  };
}
