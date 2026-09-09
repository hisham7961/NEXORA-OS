"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, type ActionResult } from "@/lib/action";
import * as Design from "@/domain/design";

function buildInput(fd: FormData) {
  return {
    assetType: str(fd, "assetType"),
    companyId: str(fd, "companyId"),
    brandId: str(fd, "brandId"),
    countryId: str(fd, "countryId"),
    dimensions: str(fd, "dimensions"),
    platform: str(fd, "platform"),
    copy: str(fd, "copy"),
    priority: str(fd, "priority"),
    deadline: str(fd, "deadline"),
    designerId: str(fd, "designerId"),
    reviewerId: str(fd, "reviewerId"),
  };
}

export async function createDesignAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({ id: (await Design.createDesignRequest(ctx, buildInput(fd))).id }));
  if (res.ok) revalidatePath("/design");
  return res;
}

export async function updateDesignAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "requestId")!;
  const res = await runAction((ctx) => Design.updateDesignRequest(ctx, id, buildInput(fd)));
  if (res.ok) { revalidatePath("/design"); revalidatePath(`/design/${id}`); }
  return res;
}

export async function setDesignStatusAction(id: string, status: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Design.setDesignStatus(ctx, id, status));
  if (res.ok) { revalidatePath("/design"); revalidatePath(`/design/${id}`); }
  return res;
}

export async function addDesignVersionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "requestId")!;
  const picked = fd.get("file");
  if (!picked || typeof picked === "string") return { ok: false, error: "Please choose the artwork file to upload." };
  const blob = picked as unknown as File;
  const body = Buffer.from(await blob.arrayBuffer());
  const res = await runAction((ctx) =>
    Design.addDesignVersionWithFile(ctx, id, { filename: blob.name, body, mimeType: blob.type || "application/octet-stream", note: str(fd, "note") }),
  );
  if (res.ok) revalidatePath(`/design/${id}`);
  return res;
}

export async function approveDesignVersionAction(requestId: string, versionId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Design.approveDesignVersion(ctx, requestId, versionId));
  if (res.ok) { revalidatePath("/design"); revalidatePath(`/design/${requestId}`); }
  return res;
}

export async function rejectDesignVersionAction(requestId: string, versionId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Design.rejectDesignVersion(ctx, requestId, versionId));
  if (res.ok) { revalidatePath("/design"); revalidatePath(`/design/${requestId}`); }
  return res;
}
