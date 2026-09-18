"use server";

import { runAction, str, type ActionResult } from "@/lib/action";
import { createDocument, renewDocument } from "@/domain/documents";

/** Create a document / certificate (audit DOM-01/02). */
export async function createDocumentAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async (ctx) => {
    const doc = await createDocument(ctx, {
      title: str(fd, "title"),
      documentTypeId: str(fd, "documentTypeId"),
      companyId: str(fd, "companyId"),
      brandId: str(fd, "brandId"),
      countryId: str(fd, "countryId"),
      productId: str(fd, "productId"),
      number: str(fd, "number"),
      issueDate: str(fd, "issueDate"),
      expiryDate: str(fd, "expiryDate"),
      visibility: str(fd, "visibility") ?? "internal",
    });
    return { id: doc.id };
  });
}

/** Renew a document / certificate to a new expiry date. */
export async function renewDocumentAction(id: string, expiryDate: string, number?: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async (ctx) => {
    const doc = await renewDocument(ctx, id, { expiryDate, number });
    return { id: doc.id };
  });
}
