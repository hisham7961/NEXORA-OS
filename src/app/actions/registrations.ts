"use server";

import { revalidatePath } from "next/cache";
import { runAction, str, type ActionResult } from "@/lib/action";
import * as Reg from "@/domain/registrations";

export async function createRegistrationAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const res = await runAction(async (ctx) => ({
    id: (
      await Reg.createRegistrationCase(ctx, {
        countryId: str(fd, "countryId"),
        brandId: str(fd, "brandId"),
        companyId: str(fd, "companyId"),
        productId: str(fd, "productId"),
        authorityId: str(fd, "authorityId"),
        registrationNumber: str(fd, "registrationNumber"),
        assignedToId: str(fd, "assignedToId"),
        agentName: str(fd, "agentName"),
        notes: str(fd, "notes"),
      })
    ).id,
  }));
  if (res.ok) revalidatePath("/registrations");
  return res;
}

function bump(id: string) {
  revalidatePath("/registrations");
  revalidatePath(`/registrations/${id}`);
}

export async function changeStageAction(id: string, status: string, comment?: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Reg.changeStage(ctx, id, status, comment));
  if (res.ok) bump(id);
  return res;
}

export async function addRequirementAction(id: string, name: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Reg.addRequirement(ctx, id, name));
  if (res.ok) bump(id);
  return res;
}

export async function setRequirementStatusAction(id: string, reqId: string, status: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Reg.setRequirementStatus(ctx, id, reqId, status));
  if (res.ok) bump(id);
  return res;
}

export async function recordAuthorityResponseAction(id: string, text: string): Promise<ActionResult> {
  const res = await runAction((ctx) => Reg.recordAuthorityResponse(ctx, id, text));
  if (res.ok) bump(id);
  return res;
}

export async function updateRegistrationAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, "id")!;
  const res = await runAction((ctx) =>
    Reg.updateRegistration(ctx, id, {
      registrationNumber: str(fd, "registrationNumber"),
      agentName: str(fd, "agentName"),
      submissionDate: str(fd, "submissionDate"),
      expiryDate: str(fd, "expiryDate"),
      renewalDate: str(fd, "renewalDate"),
      notes: str(fd, "notes"),
    }),
  );
  if (res.ok) bump(id);
  return res;
}
