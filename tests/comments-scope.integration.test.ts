import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { listComments, addComment } from "@/domain/comments";
import { ForbiddenError } from "@/lib/permissions/engine";
import type { ActorContext } from "@/lib/action";
import { customAssignment, principal } from "./helpers";

/**
 * Regression for audit ARCH-03: record comments must be scoped to the referenced
 * record, not merely to holding the module permission somewhere. A user with
 * tasks.view in Brand A only must NOT read or post comments on a Brand B task.
 *
 * DB-gated: the guard loads the referenced record, so this needs Postgres.
 */
const BRAND_A = "cmttest_brandA", BRAND_B = "cmttest_brandB";
const P = "cmttest_";
let taskA = "", taskB = "";

// Employee scoped to Brand A only (custom grant, not super).
const empA = principal([customAssignment(["tasks.view"], { brandId: BRAND_A })], { userId: "cmt-empA" });
const CTX_A: ActorContext = { principal: empA, ip: null, userAgent: null };

let dbUp = false;
beforeAll(async () => {
  try { await prisma.$queryRaw`select 1`; dbUp = true; } catch { dbUp = false; return; }
  await cleanup();
  await prisma.brand.create({ data: { id: BRAND_A, name: "Cmt A", code: "CMTA", slug: "cmt-a" } });
  await prisma.brand.create({ data: { id: BRAND_B, name: "Cmt B", code: "CMTB", slug: "cmt-b" } });
  taskA = (await prisma.task.create({ data: { title: P + "A", brandId: BRAND_A } })).id;
  taskB = (await prisma.task.create({ data: { title: P + "B", brandId: BRAND_B } })).id;
});
afterAll(async () => { if (dbUp) await cleanup(); });

async function cleanup() {
  await prisma.comment.deleteMany({ where: { entityType: "task", entityId: { in: [taskA, taskB].filter(Boolean) } } }).catch(() => {});
  await prisma.task.deleteMany({ where: { title: { startsWith: P } } }).catch(() => {});
  await prisma.brand.deleteMany({ where: { id: { in: [BRAND_A, BRAND_B] } } }).catch(() => {});
}

describe("ARCH-03 — record comments are scoped to the record", () => {
  it("allows reading comments on a task inside the caller's scope (Brand A)", async () => {
    if (!dbUp) return;
    await expect(listComments(empA, "task", taskA)).resolves.toBeInstanceOf(Array);
  });

  it("BLOCKS reading comments on an out-of-scope task (Brand B)", async () => {
    if (!dbUp) return;
    await expect(listComments(empA, "task", taskB)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("BLOCKS posting a comment on an out-of-scope task (Brand B)", async () => {
    if (!dbUp) return;
    await expect(addComment(CTX_A, { entityType: "task", entityId: taskB, body: "hi" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows posting a comment on an in-scope task (Brand A)", async () => {
    if (!dbUp) return;
    const c = await addComment(CTX_A, { entityType: "task", entityId: taskA, body: "in scope" });
    expect(c.entityId).toBe(taskA);
    expect(c.authorId).toBe("cmt-empA");
  });

  it("returns not_found for a comment target that does not exist", async () => {
    if (!dbUp) return;
    await expect(listComments(empA, "task", "cmttest_missing")).rejects.toThrow(/not_found|not found/i);
  });
});
