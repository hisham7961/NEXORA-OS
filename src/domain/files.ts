import { z } from "zod";
import type { File as FileRow, FileVersion, Folder } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertRecordInScope, can, canAnywhere, ForbiddenError, type Principal } from "@/lib/permissions/engine";
import { listQuerySchema } from "@/lib/api/pagination";
import { scopedWhere, DIMS_CBC } from "@/domain/scope";
import { ServiceError } from "@/lib/api/handler";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { optionalString } from "@/lib/validation";
import { getStorage, newStorageKey } from "@/lib/storage";
import { validateUpload, inferCategory, FILE_CATEGORIES } from "@/lib/storage/validation";

const DIMS = DIMS_CBC;

// ---------------------------------------------------------------------------
// FILE PLATFORM (§3–5) — real storage behind an abstraction, versioned,
// permission-protected, attachable to any entity. History is append-only.
// ---------------------------------------------------------------------------

export const fileQuerySchema = listQuerySchema.extend({
  folderId: z.string().optional(),
  category: z.string().optional(),
  brandId: z.string().optional(),
  includeArchived: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional(),
});
export type FileQuery = z.infer<typeof fileQuerySchema>;

function fileScope(f: { companyId: string | null; brandId: string | null; countryId: string | null }) {
  return { companyId: f.companyId, brandId: f.brandId, countryId: f.countryId };
}

function parseTags(tagsJson: string | null): string[] {
  if (!tagsJson) return [];
  try {
    const v = JSON.parse(tagsJson);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** A caller may open a restricted file only if they own it or hold view_restricted in scope. */
function assertCanOpen(principal: Principal, file: FileRow): void {
  if (file.visibility !== "restricted") return;
  if (file.ownerId && file.ownerId === principal.userId) return;
  if (can(principal, "files.view_restricted", fileScope(file))) return;
  throw new ForbiddenError("files.view_restricted");
}

export async function listFiles(principal: Principal, query: FileQuery): Promise<{ rows: (FileRow & { tags: string[] })[]; total: number }> {
  const restrictedGuard = canAnywhere(principal, "files.view_restricted")
    ? {}
    : { OR: [{ visibility: "internal" }, { ownerId: principal.userId }] };
  const where: Record<string, unknown> = {
    ...(query.includeArchived ? {} : { archivedAt: null }),
    ...restrictedGuard,
    ...scopedWhere(principal, "files.view", DIMS, {
      ...(query.folderId ? { folderId: query.folderId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { description: { contains: query.q, mode: "insensitive" } }] } : {}),
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.file.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.file.count({ where }),
  ]);
  return { rows: rows.map((f) => ({ ...f, tags: parseTags(f.tagsJson) })), total };
}

export async function getFile(principal: Principal, id: string) {
  const file = await prisma.file.findUnique({ where: { id }, include: { versions: { orderBy: { version: "desc" }, include: {} } } });
  if (!file) return null;
  assertRecordInScope(principal, "files.view", fileScope(file), DIMS);
  // Restricted files are visible in the list only to authorized users; opening
  // the detail also requires open rights.
  assertCanOpen(principal, file);
  return { ...file, tags: parseTags(file.tagsJson) };
}

export const fileMetaSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: optionalString,
  category: z.enum(FILE_CATEGORIES).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  folderId: optionalString,
  visibility: z.enum(["internal", "restricted"]).optional(),
  companyId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
});

export interface UploadInput {
  filename: string;
  body: Buffer;
  mimeType: string;
  folderId?: string | null;
  category?: string;
  tags?: string[];
  description?: string | null;
  visibility?: "internal" | "restricted";
  companyId?: string | null;
  brandId?: string | null;
  countryId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
}

/**
 * Upload a brand-new file (creates the File + its version 1). Validates size /
 * MIME / extension / category server-side, stores the bytes behind the storage
 * abstraction under a server-generated key, and records size + sha256 checksum.
 */
export async function uploadFile(ctx: ActorContext, input: UploadInput): Promise<FileRow> {
  const scope = { companyId: input.companyId ?? null, brandId: input.brandId ?? null, countryId: input.countryId ?? null };
  assertCan(ctx.principal, "files.create", scope);

  const err = validateUpload({ filename: input.filename, mimeType: input.mimeType, sizeBytes: input.body.byteLength, category: input.category });
  if (err) throw new ServiceError(err.code, err.message, 422);

  const storage = getStorage();
  const key = newStorageKey(input.filename);
  const put = await storage.put(key, input.body, input.mimeType);
  const category = input.category ?? inferCategory(input.mimeType);

  const file = await prisma.$transaction(async (tx) => {
    const f = await tx.file.create({
      data: {
        name: input.filename, mimeType: input.mimeType, sizeBytes: put.sizeBytes, storageKey: key,
        checksum: put.checksum, category, tagsJson: input.tags?.length ? JSON.stringify(input.tags) : null,
        description: input.description ?? null, folderId: input.folderId ?? null, ownerId: ctx.principal.userId,
        ...scope, visibility: input.visibility ?? "internal",
        relatedType: input.relatedType ?? null, relatedId: input.relatedId ?? null,
      },
    });
    const v = await tx.fileVersion.create({
      data: { fileId: f.id, version: 1, storageKey: key, sizeBytes: put.sizeBytes, mimeType: input.mimeType, checksum: put.checksum, uploadedById: ctx.principal.userId },
    });
    return tx.file.update({ where: { id: f.id }, data: { currentVersionId: v.id } });
  });

  await audit(ctx, { action: "file.uploaded", entityType: "File", entityId: file.id, summary: `${input.filename} (${category})`, brandId: file.brandId, companyId: file.companyId });
  return file;
}

async function loadEditableFile(ctx: ActorContext, id: string): Promise<FileRow> {
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file || file.archivedAt) throw new ServiceError("not_found", "File not found", 404);
  assertRecordInScope(ctx.principal, "files.edit", fileScope(file), DIMS);
  assertCanOpen(ctx.principal, file);
  return file;
}

/**
 * Replace with a new version — append-only. The previous version's object is
 * never touched or overwritten; a new object is stored and a new FileVersion row
 * (server-numbered max+1) is created. The File's denormalized current-version
 * fields are updated to point at it.
 */
export async function addFileVersion(ctx: ActorContext, fileId: string, input: { filename?: string; body: Buffer; mimeType: string; note?: string | null }): Promise<FileVersion> {
  const existing = await loadEditableFile(ctx, fileId);
  const filename = input.filename ?? existing.name;
  const err = validateUpload({ filename, mimeType: input.mimeType, sizeBytes: input.body.byteLength });
  if (err) throw new ServiceError(err.code, err.message, 422);

  const storage = getStorage();
  const key = newStorageKey(filename);
  const put = await storage.put(key, input.body, input.mimeType);

  const version = await prisma.$transaction(async (tx) => {
    const last = await tx.fileVersion.findFirst({ where: { fileId }, orderBy: { version: "desc" }, select: { version: true } });
    const next = (last?.version ?? 0) + 1;
    const v = await tx.fileVersion.create({
      data: { fileId, version: next, storageKey: key, sizeBytes: put.sizeBytes, mimeType: input.mimeType, checksum: put.checksum, uploadedById: ctx.principal.userId, note: input.note ?? null },
    });
    await tx.file.update({
      where: { id: fileId },
      data: { currentVersionId: v.id, storageKey: key, sizeBytes: put.sizeBytes, mimeType: input.mimeType, checksum: put.checksum, name: filename },
    });
    return v;
  });
  await audit(ctx, { action: "file.version_added", entityType: "File", entityId: fileId, summary: `v${version.version} uploaded`, brandId: existing.brandId, companyId: existing.companyId });
  return version;
}

export interface DownloadResult {
  body: Buffer;
  name: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
}

/**
 * Authorized download/preview. Enforces scope + open rights, then streams the
 * bytes from storage — restricted files are never served from a public URL, and
 * every restricted download is audited.
 */
export async function downloadFile(principal: Principal, fileId: string, versionId?: string): Promise<DownloadResult> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.archivedAt) throw new ServiceError("not_found", "File not found", 404);
  assertRecordInScope(principal, "files.view", fileScope(file), DIMS);
  assertCanOpen(principal, file);

  const version = versionId
    ? await prisma.fileVersion.findUnique({ where: { id: versionId } })
    : await prisma.fileVersion.findFirst({ where: { fileId }, orderBy: { version: "desc" } });
  if (!version || version.fileId !== fileId) throw new ServiceError("not_found", "Version not found", 404);

  const storage = getStorage();
  const obj = await storage.get(version.storageKey);

  if (file.visibility === "restricted") {
    // Audit restricted downloads specifically (§4).
    await prisma.auditLog.create({
      data: { actorId: principal.userId, action: "file.downloaded_restricted", entityType: "File", entityId: fileId, summary: `v${version.version}`, brandId: file.brandId, companyId: file.companyId },
    });
  }
  return { body: obj.body, name: file.name, mimeType: version.mimeType ?? file.mimeType ?? "application/octet-stream", sizeBytes: obj.sizeBytes, version: version.version };
}

export async function updateFileMeta(ctx: ActorContext, id: string, raw: unknown): Promise<FileRow> {
  const existing = await loadEditableFile(ctx, id);
  const input = fileMetaSchema.parse(raw);
  const data: Record<string, unknown> = {};
  for (const k of ["name", "description", "category", "folderId", "companyId", "brandId", "countryId"] as const) {
    if (input[k] !== undefined) data[k] = input[k];
  }
  if (input.tags !== undefined) data.tagsJson = input.tags.length ? JSON.stringify(input.tags) : null;
  const visibilityChanged = input.visibility !== undefined && input.visibility !== existing.visibility;
  if (input.visibility !== undefined) data.visibility = input.visibility;

  const updated = await prisma.file.update({ where: { id }, data });
  await audit(ctx, { action: "file.updated", entityType: "File", entityId: id, summary: "metadata updated", brandId: existing.brandId, companyId: existing.companyId, newValues: data });
  if (visibilityChanged) {
    await audit(ctx, { action: "file.permissions_changed", entityType: "File", entityId: id, summary: `visibility → ${input.visibility}`, brandId: existing.brandId, companyId: existing.companyId });
  }
  return updated;
}

export async function archiveFile(ctx: ActorContext, id: string): Promise<void> {
  const existing = await loadEditableFile(ctx, id);
  await prisma.file.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(ctx, { action: "file.archived", entityType: "File", entityId: id, summary: existing.name, brandId: existing.brandId, companyId: existing.companyId });
}

export async function restoreFile(ctx: ActorContext, id: string): Promise<void> {
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) throw new ServiceError("not_found", "File not found", 404);
  assertRecordInScope(ctx.principal, "files.edit", fileScope(file), DIMS);
  await prisma.file.update({ where: { id }, data: { archivedAt: null } });
  await audit(ctx, { action: "file.restored", entityType: "File", entityId: id, summary: file.name, brandId: file.brandId, companyId: file.companyId });
}

/** Full version history (newest first), for the detail view. */
export async function getFileVersions(principal: Principal, fileId: string): Promise<FileVersion[]> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) throw new ServiceError("not_found", "File not found", 404);
  assertRecordInScope(principal, "files.view", fileScope(file), DIMS);
  assertCanOpen(principal, file);
  return prisma.fileVersion.findMany({ where: { fileId }, orderBy: { version: "desc" } });
}

// ---------------------------------------------------------------------------
// FOLDERS
// ---------------------------------------------------------------------------

export const folderSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: optionalString,
  scopeType: z.enum(["shared", "department", "brand", "product", "regulatory", "creative", "restricted", "vault"]).default("shared"),
  companyId: optionalString,
  brandId: optionalString,
});

export async function listFolders(principal: Principal): Promise<Folder[]> {
  // Folders are lightweight organizers; visibility of the files within is what's
  // enforced. List those in the caller's brand/company scope (or global).
  if (!canAnywhere(principal, "files.view")) return [];
  return prisma.folder.findMany({ orderBy: { name: "asc" } });
}

export async function createFolder(ctx: ActorContext, raw: unknown): Promise<Folder> {
  const input = folderSchema.parse(raw);
  assertCan(ctx.principal, "files.create", { companyId: input.companyId ?? null, brandId: input.brandId ?? null });
  const folder = await prisma.folder.create({
    data: { name: input.name, parentId: input.parentId ?? null, scopeType: input.scopeType, companyId: input.companyId ?? null, brandId: input.brandId ?? null },
  });
  await audit(ctx, { action: "folder.created", entityType: "Folder", entityId: folder.id, summary: input.name, brandId: folder.brandId, companyId: folder.companyId });
  return folder;
}

// ---------------------------------------------------------------------------
// ENTITY ATTACHMENTS (§5) — one file platform, many attachment points.
// ---------------------------------------------------------------------------

/** Attach an existing file to an entity. The file's own scope governs access. */
export async function attachFile(ctx: ActorContext, fileId: string, entityType: string, entityId: string): Promise<void> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.archivedAt) throw new ServiceError("not_found", "File not found", 404);
  assertRecordInScope(ctx.principal, "files.view", fileScope(file), DIMS);
  assertCanOpen(ctx.principal, file);
  await prisma.fileAttachment.upsert({
    where: { fileId_entityType_entityId: { fileId, entityType, entityId } },
    create: { fileId, entityType, entityId, createdById: ctx.principal.userId },
    update: {},
  });
  await audit(ctx, { action: "file.attached", entityType, entityId, summary: `${file.name} attached`, brandId: file.brandId, companyId: file.companyId });
}

export async function detachFile(ctx: ActorContext, fileId: string, entityType: string, entityId: string): Promise<void> {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) throw new ServiceError("not_found", "File not found", 404);
  assertRecordInScope(ctx.principal, "files.edit", fileScope(file), DIMS);
  await prisma.fileAttachment.deleteMany({ where: { fileId, entityType, entityId } });
  await audit(ctx, { action: "file.detached", entityType, entityId, summary: `${file.name} detached`, brandId: file.brandId, companyId: file.companyId });
}

/** Files attached to an entity, filtered to what the caller may see. */
export async function listFilesForEntity(principal: Principal, entityType: string, entityId: string): Promise<(FileRow & { tags: string[] })[]> {
  const links = await prisma.fileAttachment.findMany({ where: { entityType, entityId }, select: { fileId: true } });
  const alsoPrimary = await prisma.file.findMany({ where: { relatedType: entityType, relatedId: entityId, archivedAt: null }, select: { id: true } });
  const ids = [...new Set([...links.map((l) => l.fileId), ...alsoPrimary.map((f) => f.id)])];
  if (ids.length === 0) return [];
  const restrictedGuard = canAnywhere(principal, "files.view_restricted") ? {} : { OR: [{ visibility: "internal" }, { ownerId: principal.userId }] };
  const files = await prisma.file.findMany({
    where: { id: { in: ids }, archivedAt: null, ...restrictedGuard, ...scopedWhere(principal, "files.view", DIMS, {}) },
    orderBy: { updatedAt: "desc" },
  });
  return files.map((f) => ({ ...f, tags: parseTags(f.tagsJson) }));
}

export { parseTags };
