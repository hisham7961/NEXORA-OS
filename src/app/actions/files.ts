"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, strList, type ActionResult } from "@/lib/action";
import * as Files from "@/domain/files";

async function fileToBuffer(f: FormDataEntryValue | null): Promise<{ buffer: Buffer; name: string; type: string } | null> {
  if (!f || typeof f === "string") return null;
  const blob = f as unknown as File;
  const ab = await blob.arrayBuffer();
  return { buffer: Buffer.from(ab), name: blob.name, type: blob.type || "application/octet-stream" };
}

/** Upload a new file. `related_type`/`related_id` optionally attach it on create. */
export async function uploadFileAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const picked = await fileToBuffer(fd.get("file"));
  if (!picked) return { ok: false, error: "Please choose a file to upload." };
  const res = await runAction(async (ctx) => {
    const file = await Files.uploadFile(ctx, {
      filename: picked.name,
      body: picked.buffer,
      mimeType: picked.type,
      folderId: str(fd, "folderId"),
      category: str(fd, "category"),
      tags: strList(fd, "tags"),
      description: str(fd, "description"),
      visibility: (str(fd, "visibility") as "internal" | "restricted") ?? "internal",
      companyId: str(fd, "companyId"),
      brandId: str(fd, "brandId"),
      countryId: str(fd, "countryId"),
      relatedType: str(fd, "relatedType"),
      relatedId: str(fd, "relatedId"),
    });
    // Attach on create if a related entity was provided.
    const rt = str(fd, "relatedType");
    const ri = str(fd, "relatedId");
    if (rt && ri) await Files.attachFile(ctx, file.id, rt, ri);
    return { id: file.id };
  });
  if (res.ok) {
    revalidatePath("/files");
    const rt = str(fd, "relatedType");
    if (rt) revalidatePath("/", "layout");
  }
  return res;
}

export async function addFileVersionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const fileId = str(fd, "fileId")!;
  const picked = await fileToBuffer(fd.get("file"));
  if (!picked) return { ok: false, error: "Please choose a file to upload." };
  const res = await runAction((ctx) =>
    Files.addFileVersion(ctx, fileId, { filename: picked.name, body: picked.buffer, mimeType: picked.type, note: str(fd, "note") }),
  );
  if (res.ok) { revalidatePath("/files"); revalidatePath(`/files/${fileId}`); }
  return res;
}

export async function updateFileMetaAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "fileId")!;
  const res = await runAction((ctx) =>
    Files.updateFileMeta(ctx, id, {
      name: str(fd, "name"),
      description: str(fd, "description"),
      category: str(fd, "category"),
      tags: strList(fd, "tags"),
      folderId: str(fd, "folderId"),
      visibility: str(fd, "visibility"),
    }),
  );
  if (res.ok) { revalidatePath("/files"); revalidatePath(`/files/${id}`); }
  return res;
}

export async function archiveFileAction(id: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Files.archiveFile(ctx, id));
  if (res.ok) { revalidatePath("/files"); revalidatePath(`/files/${id}`); }
  return res;
}

export async function createFolderAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const res = await runAction((ctx) =>
    Files.createFolder(ctx, { name: str(fd, "name"), parentId: str(fd, "parentId"), scopeType: str(fd, "scopeType"), companyId: str(fd, "companyId"), brandId: str(fd, "brandId") }),
  );
  if (res.ok) revalidatePath("/files");
  return res;
}

/** Attach/detach an existing file to an entity (used by <EntityFiles/>). */
export async function attachFileAction(fileId: string, entityType: string, entityId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Files.attachFile(ctx, fileId, entityType, entityId));
  if (res.ok) revalidatePath("/", "layout");
  return res;
}

export async function detachFileAction(fileId: string, entityType: string, entityId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Files.detachFile(ctx, fileId, entityType, entityId));
  if (res.ok) revalidatePath("/", "layout");
  return res;
}

/** Upload + attach in one step, from an entity's Files panel. */
export async function uploadAndAttachAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return uploadFileAction(_prev, fd);
}
