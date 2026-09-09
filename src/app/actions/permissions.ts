"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, strList, type ActionResult } from "@/lib/action";
import * as PA from "@/domain/permissions-admin";

export async function createRoleAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const res = await runAction((ctx) =>
    PA.createRole(ctx, { key: str(fd, "key"), name: str(fd, "name"), description: str(fd, "description"), permissions: strList(fd, "permissions") }),
  );
  if (res.ok) revalidatePath("/admin/permissions");
  return res;
}

export async function updateRoleAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "roleId")!;
  const res = await runAction((ctx) =>
    PA.updateRole(ctx, id, { name: str(fd, "name"), description: str(fd, "description"), permissions: strList(fd, "permissions") }),
  );
  if (res.ok) revalidatePath("/admin/permissions");
  return res;
}

export async function assignRoleAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const res = await runAction((ctx) =>
    PA.assignRole(ctx, {
      userId: str(fd, "userId"),
      roleId: str(fd, "roleId"),
      companyId: str(fd, "companyId"),
      brandId: str(fd, "brandId"),
      countryId: str(fd, "countryId"),
      departmentId: str(fd, "departmentId"),
      moduleKey: str(fd, "moduleKey"),
      expiresAt: str(fd, "expiresAt"),
    }),
  );
  if (res.ok) revalidatePath("/admin/permissions");
  return res;
}

export async function removeAssignmentAction(assignmentId: string): Promise<ActionResult> {
  const res = await runAction((ctx) => PA.removeAssignment(ctx, assignmentId));
  if (res.ok) revalidatePath("/admin/permissions");
  return res;
}
