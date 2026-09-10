import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";
import { D, ZERO, add, sub, roundMoney, gt, isZero } from "@/lib/money";
import { lineAmounts } from "@/lib/accounting-math";
import { canFinance, requireSettings } from "./common";
import { resolveExchangeRate } from "./setup";
import { allocateNumber } from "./numbering";
import { prepareForPost, writePostedEntry, reverseEntry } from "./posting";

/**
 * ACCOUNTS PAYABLE (§Increment D). Supplier bills, credits and payments, plus the
 * expense→GL bridge. Mirrors AR: documents drive the GL only through the posting
 * engine, each posted document stores its journalEntryId, and posting + sub-ledger
 * updates commit atomically. Amounts are Decimal (§DB-money).
 */

const lineSchema = z.object({
  description: z.string().trim().min(1).max(300),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().default(0),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  taxRateId: optionalString,
  expenseAccountId: z.string().min(1), // Dr account (expense/asset/inventory)
  productId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  departmentId: optionalString,
  campaignId: optionalString,
  storeId: optionalString,
  costCenterId: optionalString,
});

export const billSchema = z.object({
  supplierId: z.string().min(1),
  supplierRef: optionalString,
  issueDate: z.coerce.date(),
  dueDate: z.preprocess((v) => (v ? new Date(v as string) : undefined), z.date().optional()),
  currency: z.string().length(3).optional(),
  reference: optionalString,
  notes: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  departmentId: optionalString,
  campaignId: optionalString,
  storeId: optionalString,
  lines: z.array(lineSchema).min(1),
});

export const supplierCreditSchema = billSchema.omit({ dueDate: true, supplierRef: true, departmentId: true, campaignId: true, storeId: true }).extend({ reason: optionalString });

interface ComputedLine {
  description: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; discountPct: Prisma.Decimal;
  lineNet: Prisma.Decimal; taxAmount: Prisma.Decimal; taxRateId: string | null; expenseAccountId: string;
  inputTaxAccountId: string | null;
  dims: { productId: string | null; brandId: string | null; countryId: string | null; departmentId: string | null; campaignId: string | null; storeId: string | null; costCenterId: string | null };
}

async function computeLines(companyId: string, currency: string, lines: z.infer<typeof lineSchema>[], header: { brandId?: string | null; countryId?: string | null; departmentId?: string | null; campaignId?: string | null; storeId?: string | null }) {
  const settings = await requireSettings(companyId);
  const taxIds = [...new Set(lines.map((l) => l.taxRateId).filter((x): x is string => !!x))];
  const taxRates = taxIds.length ? await prisma.taxRate.findMany({ where: { id: { in: taxIds } } }) : [];
  const taxById = new Map(taxRates.map((t) => [t.id, t]));

  const computed: ComputedLine[] = [];
  let subtotal = ZERO, taxTotal = ZERO;
  for (const l of lines) {
    const tax = l.taxRateId ? taxById.get(l.taxRateId) : undefined;
    if (l.taxRateId && !tax) throw new ServiceError("bad_tax", "Tax rate not found.", 422);
    if (tax && tax.companyId && tax.companyId !== companyId) throw new ServiceError("bad_tax", "Tax rate belongs to another company.", 422);
    const { lineNet, taxAmount } = lineAmounts({ quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct, taxRatePct: tax?.rate ?? null, taxComputation: tax?.computation as never, currency, rounding: settings.roundingPolicy as never });
    subtotal = add(subtotal, lineNet); taxTotal = add(taxTotal, taxAmount);
    computed.push({
      description: l.description, quantity: D(l.quantity), unitPrice: D(l.unitPrice), discountPct: D(l.discountPct),
      lineNet, taxAmount, taxRateId: l.taxRateId ?? null, expenseAccountId: l.expenseAccountId,
      inputTaxAccountId: tax?.inputTaxAccountId ?? settings.inputTaxAccountId ?? null,
      dims: {
        productId: l.productId ?? null, brandId: l.brandId ?? header.brandId ?? null, countryId: l.countryId ?? header.countryId ?? null,
        departmentId: l.departmentId ?? header.departmentId ?? null, campaignId: l.campaignId ?? header.campaignId ?? null,
        storeId: l.storeId ?? header.storeId ?? null, costCenterId: l.costCenterId ?? null,
      },
    });
  }
  return { computed, subtotal, taxTotal, total: add(subtotal, taxTotal) };
}

// ---------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------
export const apQuerySchema = z.object({
  q: optionalString, status: optionalString, supplierId: optionalString,
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export async function listBills(principal: Principal, companyId: string, raw: unknown = {}) {
  assertCan(principal, "ap.view", { companyId });
  const q = apQuerySchema.parse(raw);
  const where: Prisma.SupplierBillWhereInput = {
    companyId, archivedAt: null,
    ...(q.status ? { status: q.status } : {}), ...(q.supplierId ? { supplierId: q.supplierId } : {}),
    ...(q.q ? { OR: [{ billNumber: { contains: q.q, mode: "insensitive" } }, { supplierRef: { contains: q.q, mode: "insensitive" } }, { supplier: { name: { contains: q.q, mode: "insensitive" } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.supplierBill.findMany({ where, orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { supplier: { select: { name: true } } } }),
    prisma.supplierBill.count({ where }),
  ]);
  return { rows, total, page: q.page, pageSize: q.pageSize };
}

export async function getBill(principal: Principal, id: string) {
  const bill = await prisma.supplierBill.findUnique({
    where: { id },
    include: { supplier: true, lines: { orderBy: { lineNo: "asc" } }, allocations: { include: { payment: { select: { paymentNumber: true } } } }, creditApplications: { include: { credit: { select: { creditNumber: true } } } } },
  });
  if (!bill) return null;
  if (!canFinance(principal, "ap.view", bill.companyId)) throw new ServiceError("forbidden", "Forbidden", 403);
  return bill;
}

async function loadSupplierForWrite(companyId: string, supplierId: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier || supplier.archivedAt) throw new ServiceError("bad_supplier", "Supplier not found.", 422);
  if (supplier.companyId && supplier.companyId !== companyId) throw new ServiceError("bad_supplier", "Supplier belongs to another company.", 422);
  return supplier;
}

export async function createBill(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "ap.create", { companyId });
  const input = billSchema.parse(raw);
  const settings = await requireSettings(companyId);
  const supplier = await loadSupplierForWrite(companyId, input.supplierId);
  const currency = (input.currency ?? supplier.currency ?? settings.baseCurrency).toUpperCase();
  const { computed, subtotal, taxTotal, total } = await computeLines(companyId, currency, input.lines, input);
  const dueDate = input.dueDate ?? (() => { const d = new Date(input.issueDate); d.setDate(d.getDate() + (supplier.paymentTermsDays ?? settings.defaultPaymentTerms)); return d; })();

  const bill = await prisma.supplierBill.create({
    data: {
      companyId, supplierId: supplier.id, status: "draft", issueDate: input.issueDate, dueDate, supplierRef: input.supplierRef ?? null,
      currency, baseCurrency: settings.baseCurrency, subtotal, taxTotal, total, amountDue: total, amountPaid: ZERO,
      brandId: input.brandId ?? supplier.brandId ?? null, countryId: input.countryId ?? supplier.countryId ?? null,
      departmentId: input.departmentId ?? null, campaignId: input.campaignId ?? null, storeId: input.storeId ?? null,
      reference: input.reference ?? null, notes: input.notes ?? null, createdById: ctx.principal.userId,
      lines: { create: computed.map((c, i) => ({ lineNo: i + 1, description: c.description, quantity: c.quantity, unitPrice: c.unitPrice, discountPct: c.discountPct, lineNet: c.lineNet, taxRateId: c.taxRateId, taxAmount: c.taxAmount, expenseAccountId: c.expenseAccountId, ...c.dims })) },
    },
    include: { lines: true },
  });
  await audit(ctx, { action: "bill.created", entityType: "SupplierBill", entityId: bill.id, summary: `Draft bill ${supplier.name} ${total} ${currency}`, companyId });
  return bill;
}

export async function updateBill(ctx: ActorContext, id: string, raw: unknown) {
  const bill = await prisma.supplierBill.findUnique({ where: { id } });
  if (!bill || bill.archivedAt) throw new ServiceError("not_found", "Bill not found", 404);
  assertCan(ctx.principal, "ap.create", { companyId: bill.companyId });
  if (bill.status !== "draft") throw new ServiceError("not_draft", "Only a draft bill can be edited.", 422);
  const input = billSchema.parse(raw);
  const settings = await requireSettings(bill.companyId);
  const supplier = await loadSupplierForWrite(bill.companyId, input.supplierId);
  const currency = (input.currency ?? supplier.currency ?? settings.baseCurrency).toUpperCase();
  const { computed, subtotal, taxTotal, total } = await computeLines(bill.companyId, currency, input.lines, input);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.supplierBillLine.deleteMany({ where: { billId: id } });
    return tx.supplierBill.update({
      where: { id },
      data: {
        supplierId: supplier.id, issueDate: input.issueDate, dueDate: input.dueDate ?? bill.dueDate, supplierRef: input.supplierRef ?? null, currency,
        subtotal, taxTotal, total, amountDue: total,
        brandId: input.brandId ?? supplier.brandId ?? null, countryId: input.countryId ?? supplier.countryId ?? null,
        departmentId: input.departmentId ?? null, campaignId: input.campaignId ?? null, storeId: input.storeId ?? null,
        reference: input.reference ?? null, notes: input.notes ?? null,
        lines: { create: computed.map((c, i) => ({ lineNo: i + 1, description: c.description, quantity: c.quantity, unitPrice: c.unitPrice, discountPct: c.discountPct, lineNet: c.lineNet, taxRateId: c.taxRateId, taxAmount: c.taxAmount, expenseAccountId: c.expenseAccountId, ...c.dims })) },
      },
      include: { lines: true },
    });
  });
  await audit(ctx, { action: "bill.updated", entityType: "SupplierBill", entityId: id, summary: `Draft bill updated ${total} ${currency}`, companyId: bill.companyId });
  return updated;
}

/** Post a draft bill: Dr Expense (per line) / Dr Input Tax / Cr Payable. Atomic. */
export async function postBill(ctx: ActorContext, id: string) {
  const bill = await prisma.supplierBill.findUnique({ where: { id }, include: { lines: { orderBy: { lineNo: "asc" } }, supplier: true } });
  if (!bill || bill.archivedAt) throw new ServiceError("not_found", "Bill not found", 404);
  assertCan(ctx.principal, "ap.create", { companyId: bill.companyId });
  if (bill.status !== "draft") throw new ServiceError("not_draft", "Only a draft bill can be posted.", 422);
  if (isZero(bill.total)) throw new ServiceError("empty", "Cannot post a zero-total bill.", 422);
  const settings = await requireSettings(bill.companyId);
  const payableAccountId = bill.supplier.payableAccountId ?? settings.payableAccountId;
  if (!payableAccountId) throw new ServiceError("no_payable_account", "No payable account configured.", 422);
  const rate = bill.currency === bill.baseCurrency ? 1 : await resolveExchangeRate(bill.currency, bill.baseCurrency, bill.issueDate);

  const jl: Record<string, unknown>[] = [];
  for (const l of bill.lines) {
    if (gt(l.lineNet, 0)) jl.push({ accountId: l.expenseAccountId, debit: Number(l.lineNet), credit: 0, supplierId: bill.supplierId, productId: l.productId ?? undefined, brandId: l.brandId ?? undefined, countryId: l.countryId ?? undefined, departmentId: l.departmentId ?? undefined, campaignId: l.campaignId ?? undefined, storeId: l.storeId ?? undefined, costCenterId: l.costCenterId ?? undefined, description: l.description });
  }
  const taxIds = [...new Set(bill.lines.map((l) => l.taxRateId).filter((x): x is string => !!x))];
  const taxRates = taxIds.length ? await prisma.taxRate.findMany({ where: { id: { in: taxIds } } }) : [];
  const inputAcctById = new Map(taxRates.map((t) => [t.id, t.inputTaxAccountId]));
  const taxByAccount = new Map<string, Prisma.Decimal>();
  for (const l of bill.lines) {
    if (gt(l.taxAmount, 0)) {
      const acct = (l.taxRateId ? inputAcctById.get(l.taxRateId) : null) ?? settings.inputTaxAccountId;
      if (!acct) throw new ServiceError("no_tax_account", "No input tax account configured.", 422);
      taxByAccount.set(acct, add(taxByAccount.get(acct) ?? ZERO, l.taxAmount));
    }
  }
  for (const [accountId, amount] of taxByAccount) jl.push({ accountId, debit: Number(amount), credit: 0, supplierId: bill.supplierId, description: "Input tax" });
  jl.push({ accountId: payableAccountId, debit: 0, credit: Number(bill.total), supplierId: bill.supplierId, brandId: bill.brandId ?? undefined, countryId: bill.countryId ?? undefined, description: bill.supplier.name });

  const journalRaw = { companyId: bill.companyId, journalCode: "PJ", date: bill.issueDate, currency: bill.currency, exchangeRate: rate === 1 ? undefined : rate, reference: bill.supplierRef ?? bill.reference ?? undefined, memo: `Bill ${bill.supplier.name}`, sourceType: "SupplierBill", sourceId: bill.id, lines: jl };
  const { input, prepared, postingDate, periodId } = await prepareForPost(ctx, journalRaw);

  const result = await prisma.$transaction(async (tx) => {
    const number = await allocateNumber(tx, { companyId: bill.companyId, key: "bill", prefix: settings.billPrefix, year: bill.issueDate.getFullYear() });
    const entry = await writePostedEntry(tx, ctx, input, prepared, postingDate, periodId);
    const updated = await tx.supplierBill.update({ where: { id }, data: { status: "open", billNumber: number, journalEntryId: entry.id, exchangeRate: D(rate), totalBase: prepared.totalCredit, postedById: ctx.principal.userId, postedAt: new Date() } });
    return { updated, entry, number };
  });
  await audit(ctx, { action: "bill.posted", entityType: "SupplierBill", entityId: id, summary: `${result.number} ${bill.supplier.name} ${bill.total} ${bill.currency} → ${result.entry.journalNumber}`, companyId: bill.companyId });
  return result.updated;
}

export async function voidBill(ctx: ActorContext, id: string, reason: string) {
  const bill = await prisma.supplierBill.findUnique({ where: { id } });
  if (!bill || bill.archivedAt) throw new ServiceError("not_found", "Bill not found", 404);
  assertCan(ctx.principal, "ap.manage", { companyId: bill.companyId });
  if (bill.status === "void") throw new ServiceError("already_void", "Bill is already void.", 422);
  if (bill.status === "draft") {
    const updated = await prisma.supplierBill.update({ where: { id }, data: { status: "void", archivedAt: new Date() } });
    await audit(ctx, { action: "bill.voided", entityType: "SupplierBill", entityId: id, summary: "Draft voided", companyId: bill.companyId });
    return updated;
  }
  if (!gt(bill.amountDue, 0) || !bill.total.equals(bill.amountDue)) throw new ServiceError("has_activity", "Bill has payments or credits applied — reverse those before voiding.", 422);
  if (!reason?.trim()) throw new ServiceError("reason_required", "A void reason is required.", 422);
  if (bill.journalEntryId) await reverseEntry(ctx, bill.journalEntryId, { reason: `Void bill ${bill.billNumber}: ${reason}` });
  const updated = await prisma.supplierBill.update({ where: { id }, data: { status: "void", amountDue: ZERO } });
  await audit(ctx, { action: "bill.voided", entityType: "SupplierBill", entityId: id, summary: `${bill.billNumber} voided: ${reason}`, companyId: bill.companyId });
  return updated;
}

// ---------------------------------------------------------------------------
// Supplier credits
// ---------------------------------------------------------------------------
export async function listSupplierCredits(principal: Principal, companyId: string, raw: unknown = {}) {
  assertCan(principal, "ap.view", { companyId });
  const q = apQuerySchema.parse(raw);
  const where: Prisma.SupplierCreditWhereInput = { companyId, archivedAt: null, ...(q.status ? { status: q.status } : {}), ...(q.supplierId ? { supplierId: q.supplierId } : {}) };
  const [rows, total] = await Promise.all([
    prisma.supplierCredit.findMany({ where, orderBy: { issueDate: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { supplier: { select: { name: true } } } }),
    prisma.supplierCredit.count({ where }),
  ]);
  return { rows, total, page: q.page, pageSize: q.pageSize };
}

export async function getSupplierCredit(principal: Principal, id: string) {
  const cr = await prisma.supplierCredit.findUnique({ where: { id }, include: { supplier: true, lines: { orderBy: { lineNo: "asc" } }, applications: { include: { bill: { select: { billNumber: true } } } } } });
  if (!cr) return null;
  if (!canFinance(principal, "ap.view", cr.companyId)) throw new ServiceError("forbidden", "Forbidden", 403);
  return cr;
}

export async function createSupplierCredit(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "ap.create", { companyId });
  const input = supplierCreditSchema.parse(raw);
  const settings = await requireSettings(companyId);
  const supplier = await loadSupplierForWrite(companyId, input.supplierId);
  const currency = (input.currency ?? supplier.currency ?? settings.baseCurrency).toUpperCase();
  const { computed, subtotal, taxTotal, total } = await computeLines(companyId, currency, input.lines, input);
  const cr = await prisma.supplierCredit.create({
    data: {
      companyId, supplierId: supplier.id, status: "draft", issueDate: input.issueDate, currency, baseCurrency: settings.baseCurrency,
      subtotal, taxTotal, total, amountRemaining: total, amountApplied: ZERO,
      brandId: input.brandId ?? supplier.brandId ?? null, countryId: input.countryId ?? supplier.countryId ?? null,
      reason: input.reason ?? null, reference: input.reference ?? null, createdById: ctx.principal.userId,
      lines: { create: computed.map((c, i) => ({ lineNo: i + 1, description: c.description, quantity: c.quantity, unitPrice: c.unitPrice, lineNet: c.lineNet, taxRateId: c.taxRateId, taxAmount: c.taxAmount, expenseAccountId: c.expenseAccountId, ...c.dims })) },
    },
    include: { lines: true },
  });
  await audit(ctx, { action: "supplier_credit.created", entityType: "SupplierCredit", entityId: cr.id, summary: `Draft credit ${supplier.name} ${total} ${currency}`, companyId });
  return cr;
}

/** Post a supplier credit: Dr Payable / Cr Expense / Cr Input Tax — mirror of the bill. */
export async function postSupplierCredit(ctx: ActorContext, id: string) {
  const cr = await prisma.supplierCredit.findUnique({ where: { id }, include: { lines: { orderBy: { lineNo: "asc" } }, supplier: true } });
  if (!cr || cr.archivedAt) throw new ServiceError("not_found", "Supplier credit not found", 404);
  assertCan(ctx.principal, "ap.create", { companyId: cr.companyId });
  if (cr.status !== "draft") throw new ServiceError("not_draft", "Only a draft credit can be posted.", 422);
  if (isZero(cr.total)) throw new ServiceError("empty", "Cannot post a zero-total credit.", 422);
  const settings = await requireSettings(cr.companyId);
  const payableAccountId = cr.supplier.payableAccountId ?? settings.payableAccountId;
  if (!payableAccountId) throw new ServiceError("no_payable_account", "No payable account configured.", 422);
  const rate = cr.currency === cr.baseCurrency ? 1 : await resolveExchangeRate(cr.currency, cr.baseCurrency, cr.issueDate);

  const taxIds = [...new Set(cr.lines.map((l) => l.taxRateId).filter((x): x is string => !!x))];
  const taxRates = taxIds.length ? await prisma.taxRate.findMany({ where: { id: { in: taxIds } } }) : [];
  const inputAcctById = new Map(taxRates.map((t) => [t.id, t.inputTaxAccountId]));

  const jl: Record<string, unknown>[] = [];
  jl.push({ accountId: payableAccountId, debit: Number(cr.total), credit: 0, supplierId: cr.supplierId, brandId: cr.brandId ?? undefined, countryId: cr.countryId ?? undefined, description: cr.supplier.name });
  for (const l of cr.lines) {
    if (gt(l.lineNet, 0)) jl.push({ accountId: l.expenseAccountId, debit: 0, credit: Number(l.lineNet), supplierId: cr.supplierId, productId: l.productId ?? undefined, brandId: l.brandId ?? undefined, countryId: l.countryId ?? undefined, departmentId: l.departmentId ?? undefined, campaignId: l.campaignId ?? undefined, storeId: l.storeId ?? undefined, costCenterId: l.costCenterId ?? undefined, description: l.description });
  }
  const taxByAccount = new Map<string, Prisma.Decimal>();
  for (const l of cr.lines) {
    if (gt(l.taxAmount, 0)) {
      const acct = (l.taxRateId ? inputAcctById.get(l.taxRateId) : null) ?? settings.inputTaxAccountId;
      if (!acct) throw new ServiceError("no_tax_account", "No input tax account configured.", 422);
      taxByAccount.set(acct, add(taxByAccount.get(acct) ?? ZERO, l.taxAmount));
    }
  }
  for (const [accountId, amount] of taxByAccount) jl.push({ accountId, debit: 0, credit: Number(amount), supplierId: cr.supplierId, description: "Input tax reversal" });

  const journalRaw = { companyId: cr.companyId, journalCode: "PJ", date: cr.issueDate, currency: cr.currency, exchangeRate: rate === 1 ? undefined : rate, reference: cr.reference ?? undefined, memo: `Supplier credit ${cr.supplier.name}${cr.reason ? `: ${cr.reason}` : ""}`, sourceType: "SupplierCredit", sourceId: cr.id, lines: jl };
  const { input, prepared, postingDate, periodId } = await prepareForPost(ctx, journalRaw);

  const updated = await prisma.$transaction(async (tx) => {
    const number = await allocateNumber(tx, { companyId: cr.companyId, key: "supplier_credit", prefix: `${settings.billPrefix}CR`, year: cr.issueDate.getFullYear() });
    const entry = await writePostedEntry(tx, ctx, input, prepared, postingDate, periodId);
    return tx.supplierCredit.update({ where: { id }, data: { status: "open", creditNumber: number, journalEntryId: entry.id, exchangeRate: D(rate), totalBase: prepared.totalDebit, postedById: ctx.principal.userId, postedAt: new Date() } });
  });
  await audit(ctx, { action: "supplier_credit.posted", entityType: "SupplierCredit", entityId: id, summary: `${updated.creditNumber} ${cr.supplier.name} ${cr.total} ${cr.currency}`, companyId: cr.companyId });
  return updated;
}

/** Apply an open supplier credit against one or more open bills (sub-ledger contra). */
export async function applySupplierCredit(ctx: ActorContext, creditId: string, allocations: { billId: string; amount: number }[]) {
  const cr = await prisma.supplierCredit.findUnique({ where: { id: creditId } });
  if (!cr) throw new ServiceError("not_found", "Supplier credit not found", 404);
  assertCan(ctx.principal, "ap.create", { companyId: cr.companyId });
  if (cr.status !== "open" && cr.status !== "applied") throw new ServiceError("not_open", "Credit must be posted before applying.", 422);
  if (!allocations.length) throw new ServiceError("empty", "No allocations provided.", 422);

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.supplierCredit.findUnique({ where: { id: creditId } });
    if (!fresh) throw new ServiceError("not_found", "Supplier credit not found", 404);
    let remaining = D(fresh.amountRemaining);
    for (const a of allocations) {
      const amt = roundMoney(a.amount, cr.currency);
      if (!gt(amt, 0)) continue;
      if (gt(amt, remaining)) throw new ServiceError("over_apply", "Allocation exceeds the credit's remaining balance.", 422);
      const bill = await tx.supplierBill.findUnique({ where: { id: a.billId } });
      if (!bill || bill.companyId !== cr.companyId || bill.supplierId !== cr.supplierId) throw new ServiceError("bad_bill", "Bill not found for this supplier.", 422);
      if (!["open", "partially_paid"].includes(bill.status)) throw new ServiceError("not_open", "Bill is not open.", 422);
      if (gt(amt, bill.amountDue)) throw new ServiceError("over_apply", "Allocation exceeds the bill balance due.", 422);
      await tx.supplierCreditApplication.upsert({ where: { creditId_billId: { creditId, billId: a.billId } }, create: { creditId, billId: a.billId, amount: amt }, update: { amount: { increment: amt } } });
      const newDue = sub(bill.amountDue, amt);
      await tx.supplierBill.update({ where: { id: a.billId }, data: { amountPaid: add(bill.amountPaid, amt), amountDue: newDue, status: isZero(newDue) ? "paid" : "partially_paid" } });
      remaining = sub(remaining, amt);
    }
    await tx.supplierCredit.update({ where: { id: creditId }, data: { amountApplied: sub(cr.total, remaining), amountRemaining: remaining, status: isZero(remaining) ? "applied" : "open" } });
  });
  await audit(ctx, { action: "supplier_credit.applied", entityType: "SupplierCredit", entityId: creditId, summary: `Applied ${cr.creditNumber}`, companyId: cr.companyId });
}

// ---------------------------------------------------------------------------
// Supplier payments
// ---------------------------------------------------------------------------
export const paymentSchema = z.object({
  supplierId: z.string().min(1),
  paymentDate: z.coerce.date(),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3).optional(),
  method: z.enum(["bank", "cash", "card", "cheque", "transfer"]).default("bank"),
  bankAccountId: optionalString,
  reference: optionalString,
  notes: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  allocations: z.array(z.object({ billId: z.string().min(1), amount: z.coerce.number().positive() })).default([]),
});

export async function listPayments(principal: Principal, companyId: string, raw: unknown = {}) {
  assertCan(principal, "payments.view", { companyId });
  const q = apQuerySchema.parse(raw);
  const where: Prisma.SupplierPaymentWhereInput = { companyId, archivedAt: null, ...(q.status ? { status: q.status } : {}), ...(q.supplierId ? { supplierId: q.supplierId } : {}) };
  const [rows, total] = await Promise.all([
    prisma.supplierPayment.findMany({ where, orderBy: { paymentDate: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { supplier: { select: { name: true } } } }),
    prisma.supplierPayment.count({ where }),
  ]);
  return { rows, total, page: q.page, pageSize: q.pageSize };
}

export async function getPayment(principal: Principal, id: string) {
  const p = await prisma.supplierPayment.findUnique({ where: { id }, include: { supplier: true, allocations: { include: { bill: { select: { billNumber: true, total: true } } } } } });
  if (!p) return null;
  if (!canFinance(principal, "payments.view", p.companyId)) throw new ServiceError("forbidden", "Forbidden", 403);
  return p;
}

/** Record + post a supplier payment: Dr Payable · Cr Bank/Cash, allocated to open bills. Atomic. */
export async function postPayment(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "payments.create", { companyId });
  const input = paymentSchema.parse(raw);
  const settings = await requireSettings(companyId);
  const supplier = await loadSupplierForWrite(companyId, input.supplierId);
  const currency = (input.currency ?? supplier.currency ?? settings.baseCurrency).toUpperCase();
  const amount = roundMoney(input.amount, currency);
  const rate = currency === settings.baseCurrency ? 1 : await resolveExchangeRate(currency, settings.baseCurrency, input.paymentDate);

  const fundingAccountId = input.bankAccountId ?? settings.cashAccountId ?? settings.bankClearingAccountId;
  const payableAccountId = supplier.payableAccountId ?? settings.payableAccountId;
  if (!fundingAccountId) throw new ServiceError("no_cash_account", "No cash/bank account configured for payments.", 422);
  if (!payableAccountId) throw new ServiceError("no_payable_account", "No payable account configured.", 422);

  let allocTotal = ZERO;
  for (const a of input.allocations) allocTotal = add(allocTotal, roundMoney(a.amount, currency));
  if (gt(allocTotal, amount)) throw new ServiceError("over_allocate", "Allocations exceed the payment amount.", 422);

  const journalRaw = {
    companyId, journalCode: "BJ", date: input.paymentDate, currency, exchangeRate: rate === 1 ? undefined : rate,
    reference: input.reference ?? undefined, memo: `Payment ${supplier.name}`, sourceType: "SupplierPayment", sourceId: "pending",
    lines: [
      { accountId: payableAccountId, debit: Number(amount), credit: 0, supplierId: supplier.id, brandId: input.brandId ?? undefined, countryId: input.countryId ?? undefined, description: supplier.name },
      { accountId: fundingAccountId, debit: 0, credit: Number(amount), supplierId: supplier.id, brandId: input.brandId ?? undefined, countryId: input.countryId ?? undefined, description: `Payment ${supplier.name}` },
    ],
  };
  const { input: jInput, prepared, postingDate, periodId } = await prepareForPost(ctx, journalRaw);

  const payment = await prisma.$transaction(async (tx) => {
    const number = await allocateNumber(tx, { companyId, key: "supplier_payment", prefix: `${settings.paymentPrefix}P`, year: input.paymentDate.getFullYear() });
    const pay = await tx.supplierPayment.create({
      data: {
        companyId, supplierId: supplier.id, status: "posted", paymentNumber: number, paymentDate: input.paymentDate,
        currency, baseCurrency: settings.baseCurrency, exchangeRate: D(rate), amount, amountBase: prepared.totalDebit,
        allocatedAmount: allocTotal, unappliedAmount: sub(amount, allocTotal),
        bankAccountId: input.bankAccountId ?? null, method: input.method, reference: input.reference ?? null, notes: input.notes ?? null,
        brandId: input.brandId ?? null, countryId: input.countryId ?? null, postedById: ctx.principal.userId, postedAt: new Date(), createdById: ctx.principal.userId,
      },
    });
    const entry = await writePostedEntry(tx, ctx, { ...jInput, sourceId: pay.id }, prepared, postingDate, periodId);
    const withEntry = await tx.supplierPayment.update({ where: { id: pay.id }, data: { journalEntryId: entry.id } });
    for (const a of input.allocations) {
      const amt = roundMoney(a.amount, currency);
      if (!gt(amt, 0)) continue;
      const bill = await tx.supplierBill.findUnique({ where: { id: a.billId } });
      if (!bill || bill.companyId !== companyId || bill.supplierId !== supplier.id) throw new ServiceError("bad_bill", "Bill not found for this supplier.", 422);
      if (!["open", "partially_paid"].includes(bill.status)) throw new ServiceError("not_open", `Bill ${bill.billNumber} is not open.`, 422);
      if (gt(amt, bill.amountDue)) throw new ServiceError("over_allocate", `Allocation exceeds bill ${bill.billNumber} balance.`, 422);
      await tx.billPaymentAllocation.create({ data: { paymentId: pay.id, billId: a.billId, amount: amt } });
      const newDue = sub(bill.amountDue, amt);
      await tx.supplierBill.update({ where: { id: a.billId }, data: { amountPaid: add(bill.amountPaid, amt), amountDue: newDue, status: isZero(newDue) ? "paid" : "partially_paid" } });
    }
    return withEntry;
  });
  await audit(ctx, { action: "payment.posted", entityType: "SupplierPayment", entityId: payment.id, summary: `${payment.paymentNumber} ${supplier.name} ${amount} ${currency}`, companyId });
  return payment;
}

export async function allocatePayment(ctx: ActorContext, paymentId: string, allocations: { billId: string; amount: number }[]) {
  const pay = await prisma.supplierPayment.findUnique({ where: { id: paymentId } });
  if (!pay) throw new ServiceError("not_found", "Payment not found", 404);
  assertCan(ctx.principal, "payments.create", { companyId: pay.companyId });
  if (pay.status !== "posted") throw new ServiceError("not_posted", "Payment is not posted.", 422);

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.supplierPayment.findUnique({ where: { id: paymentId } });
    if (!fresh) throw new ServiceError("not_found", "Payment not found", 404);
    let unapplied = D(fresh.unappliedAmount);
    for (const a of allocations) {
      const amt = roundMoney(a.amount, pay.currency);
      if (!gt(amt, 0)) continue;
      if (gt(amt, unapplied)) throw new ServiceError("over_allocate", "Allocation exceeds the payment's unapplied balance.", 422);
      const bill = await tx.supplierBill.findUnique({ where: { id: a.billId } });
      if (!bill || bill.companyId !== pay.companyId || bill.supplierId !== pay.supplierId) throw new ServiceError("bad_bill", "Bill not found for this supplier.", 422);
      if (!["open", "partially_paid"].includes(bill.status)) throw new ServiceError("not_open", "Bill is not open.", 422);
      if (gt(amt, bill.amountDue)) throw new ServiceError("over_allocate", "Allocation exceeds bill balance.", 422);
      await tx.billPaymentAllocation.upsert({ where: { paymentId_billId: { paymentId, billId: a.billId } }, create: { paymentId, billId: a.billId, amount: amt }, update: { amount: { increment: amt } } });
      const newDue = sub(bill.amountDue, amt);
      await tx.supplierBill.update({ where: { id: a.billId }, data: { amountPaid: add(bill.amountPaid, amt), amountDue: newDue, status: isZero(newDue) ? "paid" : "partially_paid" } });
      unapplied = sub(unapplied, amt);
    }
    await tx.supplierPayment.update({ where: { id: paymentId }, data: { unappliedAmount: unapplied, allocatedAmount: sub(pay.amount, unapplied) } });
  });
  await audit(ctx, { action: "payment.allocated", entityType: "SupplierPayment", entityId: paymentId, summary: `Allocated ${pay.paymentNumber}`, companyId: pay.companyId });
}

// ---------------------------------------------------------------------------
// AP reports
// ---------------------------------------------------------------------------
const AGING_BUCKETS = [30, 60, 90] as const;

/** AP aging as of a date: open bill balances bucketed by days overdue. */
export async function apAging(principal: Principal, companyId: string, asOf: Date = new Date()) {
  assertCan(principal, "ap.view", { companyId });
  const bills = await prisma.supplierBill.findMany({
    where: { companyId, archivedAt: null, status: { in: ["open", "partially_paid"] }, issueDate: { lte: asOf } },
    select: { id: true, supplierId: true, dueDate: true, issueDate: true, amountDue: true, supplier: { select: { name: true } } },
  });
  const bySupplier = new Map<string, { supplierId: string; name: string; current: Prisma.Decimal; d30: Prisma.Decimal; d60: Prisma.Decimal; d90: Prisma.Decimal; older: Prisma.Decimal; total: Prisma.Decimal }>();
  for (const bill of bills) {
    const due = bill.dueDate ?? bill.issueDate;
    const days = Math.floor((asOf.getTime() - due.getTime()) / 86400000);
    const row = bySupplier.get(bill.supplierId) ?? { supplierId: bill.supplierId, name: bill.supplier.name, current: ZERO, d30: ZERO, d60: ZERO, d90: ZERO, older: ZERO, total: ZERO };
    const amt = D(bill.amountDue);
    if (days <= 0) row.current = add(row.current, amt);
    else if (days <= AGING_BUCKETS[0]) row.d30 = add(row.d30, amt);
    else if (days <= AGING_BUCKETS[1]) row.d60 = add(row.d60, amt);
    else if (days <= AGING_BUCKETS[2]) row.d90 = add(row.d90, amt);
    else row.older = add(row.older, amt);
    row.total = add(row.total, amt);
    bySupplier.set(bill.supplierId, row);
  }
  const rows = [...bySupplier.values()].sort((a, b) => (gt(b.total, a.total) ? 1 : -1));
  const totals = rows.reduce((t, r) => ({ current: add(t.current, r.current), d30: add(t.d30, r.d30), d60: add(t.d60, r.d60), d90: add(t.d90, r.d90), older: add(t.older, r.older), total: add(t.total, r.total) }), { current: ZERO, d30: ZERO, d60: ZERO, d90: ZERO, older: ZERO, total: ZERO });
  return { asOf, rows, totals };
}

/** A supplier statement: chronological bills, credits and payments with running balance. */
export async function supplierStatement(principal: Principal, companyId: string, supplierId: string, from?: Date, to: Date = new Date()) {
  assertCan(principal, "ap.view", { companyId });
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier || (supplier.companyId && supplier.companyId !== companyId)) throw new ServiceError("not_found", "Supplier not found", 404);
  const [bills, credits, payments] = await Promise.all([
    prisma.supplierBill.findMany({ where: { companyId, supplierId, status: { notIn: ["draft", "void"] }, issueDate: { lte: to, ...(from ? { gte: from } : {}) } }, select: { billNumber: true, issueDate: true, total: true, currency: true } }),
    prisma.supplierCredit.findMany({ where: { companyId, supplierId, status: { notIn: ["draft", "void"] }, issueDate: { lte: to, ...(from ? { gte: from } : {}) } }, select: { creditNumber: true, issueDate: true, total: true, currency: true } }),
    prisma.supplierPayment.findMany({ where: { companyId, supplierId, status: "posted", paymentDate: { lte: to, ...(from ? { gte: from } : {}) } }, select: { paymentNumber: true, paymentDate: true, amount: true, currency: true } }),
  ]);
  type Row = { date: Date; type: string; ref: string; debit: Prisma.Decimal; credit: Prisma.Decimal; currency: string };
  const rows: Row[] = [
    ...bills.map((b) => ({ date: b.issueDate, type: "Bill", ref: b.billNumber ?? "—", debit: ZERO, credit: D(b.total), currency: b.currency })),
    ...credits.map((c) => ({ date: c.issueDate, type: "Credit", ref: c.creditNumber ?? "—", debit: D(c.total), credit: ZERO, currency: c.currency })),
    ...payments.map((p) => ({ date: p.paymentDate, type: "Payment", ref: p.paymentNumber ?? "—", debit: D(p.amount), credit: ZERO, currency: p.currency })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  let balance = ZERO;
  const withBalance = rows.map((r) => { balance = add(sub(balance, r.debit), r.credit); return { ...r, balance }; });
  return { supplier, from, to, rows: withBalance, closingBalance: balance };
}
