"use server";

import { runAction, type ActionResult } from "@/lib/action";
import { commitImport } from "@/domain/importers";

export async function commitImportAction(resource: string, companyId: string | null, csvText: string, mapping: Record<string, string>, fileName?: string): Promise<ActionResult<{ created: number; skipped: number; errorCount: number; errors: { index: number; issue: string }[] }>> {
  return runAction((ctx) => commitImport(ctx, resource, companyId, csvText, mapping, fileName));
}
