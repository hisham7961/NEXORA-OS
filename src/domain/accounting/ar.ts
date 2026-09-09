import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { Principal } from "@/lib/permissions/engine";
import { prisma } from "@/lib/db";
import { assertCan, audit, type ActorContext } from "@/domain/mutation";
import { ServiceError } from "@/lib/api/handler";
import { optionalString } from "@/lib/validation";
import { D, ZERO, add, sub, mul, roundMoney, gt, isNeg, isZero } from "@/lib/money";
import { canFinance, requireSettings } from "./common";
import { resolveExchangeRate } from "./setup";
import { allocateNumber } from "./numbering";
import { prepareForPost, writePostedEntry } from "./posting";
import { reverseEntry } from "./posting";

/**
 * ACCOUNTS RECEIVABLE (§Increment C). Sales invoices, credit notes and customer
 * receipts. Every issued/posted document drives the GL only through the posting
 * engine (posting.ts) — these services never insert JournalLine rows directly.
 * Amounts are Decimal (§DB-money); documents are the AR sub-ledger and each posted
 * document carries its GL entry id (§80). Draft documents are mutable; once posted
 * they are corrected by void/reversal, never silent rewrite (§3).
 */

// ---------------------------------------------------------------------------
// Line + document schemas
// ---------------------------------------------------------------------------
const lineSchema = z.object({
  description: z.string().trim().min(1).max(300),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().default(0),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  taxRateId: optionalString,
  revenueAccountId: optionalString,
  productId: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  departmentId: optionalString,
  campaignId: optionalString,
  storeId: optionalString,
  costCenterId: optionalString,
});

export const invoiceSchema = z.object({
  customerId: z.string().min(1),
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

export const creditNoteSchema = invoiceSchema.omit({ dueDate: true, departmentId: true, campaignId: true, storeId: true }).extend({
  reason: optionalString,
  appliesToInvoiceId: optionalString,
});

// ---------------------------------------------------------------------------
// Amount computation (Decimal-safe)
// ---------------------------------------------------------------------------
interface ComputedLine {
  description: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; discountPct: Prisma.Decimal;
  lineNet: Prisma.Decimal; taxAmount: Prisma.Decimal; taxRateId: string | null;
  revenueAccountId: string | null; outputTaxAccountId: string | null;
  dims: { productId: string | null; brandId: string | null; countryId: string | null; departmentId: string | null; campaignId: string | null; storeId: string | null; costCenterId: string | null };
}

async function computeLines(companyId: string, currency: string, lines: z.infer<typeof lineSchema>[], header: { brandId?: string | null; countryId?: string | null; departmentId?: string | null; campaignId?: string | null; storeId?: string | null }): Promise<{ computed: ComputedLine[]; subtotal: Prisma.Decimal; taxTotal: Prisma.Decimal; total: Prisma.Decimal }> {
  const settings = await requireSettings(companyId);
  const taxIds = [...new Set(lines.map((l) => l.taxRateId).filter((x): x is string => !!x))];
  const taxRates = taxIds.length ? await prisma.taxRate.findMany({ where: { id: { in: taxIds } } }) : [];
  const taxById = new Map(taxRates.map((t) => [t.id, t]));

  const computed: ComputedLine[] = [];
  let subtotal = ZERO, taxTotal = ZERO;
  for (const l of lines) {
    const gross = mul(mul(l.quantity, l.unitPrice), sub(1, D(l.discountPct).div(100)));
    const tax = l.taxRateId ? taxById.get(l.taxRateId) : undefined;
    if (l.taxRateId && !tax) throw new ServiceError("bad_tax", "Tax rate not found.", 422);
    if (tax && tax.companyId && tax.companyId !== companyId) throw new ServiceError("bad_tax", "Tax rate belongs to another company.", 422);
    let lineNet: Prisma.Decimal, taxAmount: Prisma.Decimal;
    if (tax && tax.computation === "inclusive") {
      const grossR = roundMoney(gross, currency, settings.roundingPolicy as never);
      lineNet = roundMoney(D(grossR).div(add(1, D(tax.rate).div(100))), currency, settings.roundingPolicy as never);
      taxAmount = sub(grossR, lineNet);
    } else {
      lineNet = roundMoney(gross, currency, settings.roundingPolicy as never);
      taxAmount = tax ? roundMoney(mul(lineNet, D(tax.rate).div(100)), currency, settings.roundingPolicy as never) : ZERO;
    }
    subtotal = add(subtotal, lineNet); taxTotal = add(taxTotal, taxAmount);
    computed.push({
      description: l.description, quantity: D(l.quantity), unitPrice: D(l.unitPrice), discountPct: D(l.discountPct),
      lineNet, taxAmount, taxRateId: l.taxRateId ?? null,
      revenueAccountId: l.revenueAccountId ?? settings.revenueAccountId ?? null,
      outputTaxAccountId: tax?.outputTaxAccountId ?? settings.outputTaxAccountId ?? null,
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
// Sales invoices
// ---------------------------------------------------------------------------
export const invoiceQuerySchema = z.object({
  q: optionalString,
  status: optionalString,
  customerId: optionalString,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export async function listInvoices(principal: Principal, companyId: string, raw: unknown = {}) {
  assertCan(principal, "ar.view", { companyId });
  const q = invoiceQuerySchema.parse(raw);
  const where: Prisma.SalesInvoiceWhereInput = {
    companyId, archivedAt: null,
    ...(q.status ? { status: q.status } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.q ? { OR: [{ invoiceNumber: { contains: q.q, mode: "insensitive" } }, { reference: { contains: q.q, mode: "insensitive" } }, { customer: { name: { contains: q.q, mode: "insensitive" } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.salesInvoice.findMany({ where, orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { customer: { select: { name: true } } } }),
    prisma.salesInvoice.count({ where }),
  ]);
  return { rows, total, page: q.page, pageSize: q.pageSize };
}

export async function getInvoice(principal: Principal, id: string) {
  const inv = await prisma.salesInvoice.findUnique({
    where: { id },
    include: { customer: true, lines: { orderBy: { lineNo: "asc" } }, allocations: { include: { receipt: { select: { receiptNumber: true, receiptDate: true } } } }, creditApplications: { include: { creditNote: { select: { creditNoteNumber: true, issueDate: true } } } } },
  });
  if (!inv) return null;
  if (!canFinance(principal, "ar.view", inv.companyId)) throw new ServiceError("forbidden", "Forbidden", 403);
  return inv;
}

async function loadCustomerForWrite(companyId: string, customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || customer.archivedAt) throw new ServiceError("bad_customer", "Customer not found.", 422);
  if (customer.companyId && customer.companyId !== companyId) throw new ServiceError("bad_customer", "Customer belongs to another company.", 422);
  return customer;
}

export async function createInvoice(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "ar.create", { companyId });
  const input = invoiceSchema.parse(raw);
  const settings = await requireSettings(companyId);
  const customer = await loadCustomerForWrite(companyId, input.customerId);
  const currency = (input.currency ?? customer.currency ?? settings.baseCurrency).toUpperCase();
  const { computed, subtotal, taxTotal, total } = await computeLines(companyId, currency, input.lines, input);
  const dueDate = input.dueDate ?? (() => { const d = new Date(input.issueDate); d.setDate(d.getDate() + (customer.paymentTermsDays ?? settings.defaultPaymentTerms)); return d; })();

  const inv = await prisma.salesInvoice.create({
    data: {
      companyId, customerId: customer.id, status: "draft", issueDate: input.issueDate, dueDate,
      currency, baseCurrency: settings.baseCurrency,
      subtotal, taxTotal, total, amountDue: total, amountPaid: ZERO,
      brandId: input.brandId ?? customer.brandId ?? null, countryId: input.countryId ?? customer.countryId ?? null,
      departmentId: input.departmentId ?? null, campaignId: input.campaignId ?? null, storeId: input.storeId ?? null,
      reference: input.reference ?? null, notes: input.notes ?? null, createdById: ctx.principal.userId,
      lines: {
        create: computed.map((c, i) => ({
          lineNo: i + 1, description: c.description, quantity: c.quantity, unitPrice: c.unitPrice, discountPct: c.discountPct,
          lineNet: c.lineNet, taxRateId: c.taxRateId, taxAmount: c.taxAmount, revenueAccountId: c.revenueAccountId,
          ...c.dims,
        })),
      },
    },
    include: { lines: true },
  });
  await audit(ctx, { action: "invoice.created", entityType: "SalesInvoice", entityId: inv.id, summary: `Draft invoice ${customer.name} ${total} ${currency}`, companyId });
  return inv;
}

export async function updateInvoice(ctx: ActorContext, id: string, raw: unknown) {
  const inv = await prisma.salesInvoice.findUnique({ where: { id } });
  if (!inv || inv.archivedAt) throw new ServiceError("not_found", "Invoice not found", 404);
  assertCan(ctx.principal, "ar.create", { companyId: inv.companyId });
  if (inv.status !== "draft") throw new ServiceError("not_draft", "Only a draft invoice can be edited. Issued invoices are corrected by credit note.", 422);
  const input = invoiceSchema.parse(raw);
  const settings = await requireSettings(inv.companyId);
  const customer = await loadCustomerForWrite(inv.companyId, input.customerId);
  const currency = (input.currency ?? customer.currency ?? settings.baseCurrency).toUpperCase();
  const { computed, subtotal, taxTotal, total } = await computeLines(inv.companyId, currency, input.lines, input);
  const dueDate = input.dueDate ?? inv.dueDate;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.salesInvoiceLine.deleteMany({ where: { invoiceId: id } });
    return tx.salesInvoice.update({
      where: { id },
      data: {
        customerId: customer.id, issueDate: input.issueDate, dueDate, currency,
        subtotal, taxTotal, total, amountDue: total,
        brandId: input.brandId ?? customer.brandId ?? null, countryId: input.countryId ?? customer.countryId ?? null,
        departmentId: input.departmentId ?? null, campaignId: input.campaignId ?? null, storeId: input.storeId ?? null,
        reference: input.reference ?? null, notes: input.notes ?? null,
        lines: { create: computed.map((c, i) => ({ lineNo: i + 1, description: c.description, quantity: c.quantity, unitPrice: c.unitPrice, discountPct: c.discountPct, lineNet: c.lineNet, taxRateId: c.taxRateId, taxAmount: c.taxAmount, revenueAccountId: c.revenueAccountId, ...c.dims })) },
      },
      include: { lines: true },
    });
  });
  await audit(ctx, { action: "invoice.updated", entityType: "SalesInvoice", entityId: id, summary: `Draft invoice updated ${total} ${currency}`, companyId: inv.companyId });
  return updated;
}

/** Build the balanced journal input for a sales invoice: Dr Receivable / Cr Revenue (per line) / Cr Output Tax. */
async function invoiceJournalInput(inv: { id: string; companyId: string; customerId: string; issueDate: Date; currency: string; total: Prisma.Decimal; reference: string | null; brandId: string | null; countryId: string | null; invoiceNumber?: string | null }, lines: { description: string; lineNet: Prisma.Decimal; taxAmount: Prisma.Decimal; revenueAccountId: string | null; taxRateId: string | null; productId: string | null; brandId: string | null; countryId: string | null; departmentId: string | null; campaignId: string | null; storeId: string | null; costCenterId: string | null }[], customer: { name: string; receivableAccountId: string | null }, rate: number) {
  const settings = await requireSettings(inv.companyId);
  const receivableAccountId = customer.receivableAccountId ?? settings.receivableAccountId;
  if (!receivableAccountId) throw new ServiceError("no_receivable_account", "No receivable account configured. Set it in accounting settings or on the customer.", 422);

  const jl: Record<string, unknown>[] = [];
  jl.push({ accountId: receivableAccountId, debit: Number(inv.total), credit: 0, customerId: inv.customerId, brandId: inv.brandId ?? undefined, countryId: inv.countryId ?? undefined, description: `${customer.name}` });
  const taxByAccount = new Map<string, Prisma.Decimal>();
  for (const l of lines) {
    if (gt(l.lineNet, 0)) {
      if (!l.revenueAccountId) throw new ServiceError("no_revenue_account", "No revenue account for a line. Configure a default revenue account.", 422);
      jl.push({ accountId: l.revenueAccountId, debit: 0, credit: Number(l.lineNet), customerId: inv.customerId, productId: l.productId ?? undefined, brandId: l.brandId ?? undefined, countryId: l.countryId ?? undefined, departmentId: l.departmentId ?? undefined, campaignId: l.campaignId ?? undefined, storeId: l.storeId ?? undefined, costCenterId: l.costCenterId ?? undefined, description: l.description });
    }
    if (gt(l.taxAmount, 0)) {
      const settingsTax = settings.outputTaxAccountId;
      const taxAcct = (l as { outputTaxAccountId?: string | null }).outputTaxAccountId ?? settingsTax;
      if (!taxAcct) throw new ServiceError("no_tax_account", "No output tax account configured.", 422);
      taxByAccount.set(taxAcct, add(taxByAccount.get(taxAcct) ?? ZERO, l.taxAmount));
    }
  }
  for (const [accountId, amount] of taxByAccount) jl.push({ accountId, debit: 0, credit: Number(amount), customerId: inv.customerId, brandId: inv.brandId ?? undefined, countryId: inv.countryId ?? undefined, description: "Output tax" });

  return {
    companyId: inv.companyId, journalCode: "SJ", date: inv.issueDate, currency: inv.currency,
    exchangeRate: rate === 1 ? undefined : rate,
    reference: inv.reference ?? undefined, memo: `Invoice ${inv.invoiceNumber ?? ""} ${customer.name}`.trim(),
    sourceType: "SalesInvoice", sourceId: inv.id, lines: jl,
  };
}

/** Issue (post) a draft invoice: allocate its number, post the GL, and mark it issued — all atomic. */
export async function issueInvoice(ctx: ActorContext, id: string) {
  const inv = await prisma.salesInvoice.findUnique({ where: { id }, include: { lines: { orderBy: { lineNo: "asc" } }, customer: true } });
  if (!inv || inv.archivedAt) throw new ServiceError("not_found", "Invoice not found", 404);
  assertCan(ctx.principal, "ar.create", { companyId: inv.companyId });
  if (inv.status !== "draft") throw new ServiceError("not_draft", "Only a draft invoice can be issued.", 422);
  if (isZero(inv.total)) throw new ServiceError("empty", "Cannot issue a zero-total invoice.", 422);
  const settings = await requireSettings(inv.companyId);
  const rate = inv.currency === inv.baseCurrency ? 1 : await resolveExchangeRate(inv.currency, inv.baseCurrency, inv.issueDate);

  // Attach outputTaxAccount per line for the journal builder.
  const taxIds = [...new Set(inv.lines.map((l) => l.taxRateId).filter((x): x is string => !!x))];
  const taxRates = taxIds.length ? await prisma.taxRate.findMany({ where: { id: { in: taxIds } } }) : [];
  const taxAcctById = new Map(taxRates.map((t) => [t.id, t.outputTaxAccountId]));
  const linesForJournal = inv.lines.map((l) => ({ ...l, outputTaxAccountId: (l.taxRateId ? taxAcctById.get(l.taxRateId) : null) ?? settings.outputTaxAccountId ?? null }));

  const journalRaw = await invoiceJournalInput(inv, linesForJournal, inv.customer, rate);
  const { input, prepared, postingDate, periodId } = await prepareForPost(ctx, journalRaw);

  const result = await prisma.$transaction(async (tx) => {
    const number = await allocateNumber(tx, { companyId: inv.companyId, key: "invoice", prefix: settings.invoicePrefix, year: inv.issueDate.getFullYear() });
    const entry = await writePostedEntry(tx, ctx, input, prepared, postingDate, periodId);
    const updated = await tx.salesInvoice.update({
      where: { id },
      data: { status: "issued", invoiceNumber: number, journalEntryId: entry.id, exchangeRate: D(rate), totalBase: prepared.totalDebit, postedById: ctx.principal.userId, postedAt: new Date() },
    });
    return { updated, entry, number };
  });
  await audit(ctx, { action: "invoice.issued", entityType: "SalesInvoice", entityId: id, summary: `${result.number} ${inv.customer.name} ${inv.total} ${inv.currency} → ${result.entry.journalNumber}`, companyId: inv.companyId });
  return result.updated;
}

/** Void an issued invoice: reverse its GL entry and mark it void. Requires it has no applied receipts/credits. */
export async function voidInvoice(ctx: ActorContext, id: string, reason: string) {
  const inv = await prisma.salesInvoice.findUnique({ where: { id } });
  if (!inv || inv.archivedAt) throw new ServiceError("not_found", "Invoice not found", 404);
  assertCan(ctx.principal, "ar.manage", { companyId: inv.companyId });
  if (inv.status === "void") throw new ServiceError("already_void", "Invoice is already void.", 422);
  if (inv.status === "draft") {
    const updated = await prisma.salesInvoice.update({ where: { id }, data: { status: "void", archivedAt: new Date() } });
    await audit(ctx, { action: "invoice.voided", entityType: "SalesInvoice", entityId: id, summary: `Draft voided`, companyId: inv.companyId });
    return updated;
  }
  if (!gt(inv.amountDue, 0) || !inv.total.equals(inv.amountDue)) throw new ServiceError("has_activity", "Invoice has receipts or credits applied — reverse those before voiding.", 422);
  if (!reason?.trim()) throw new ServiceError("reason_required", "A void reason is required.", 422);
  if (inv.journalEntryId) await reverseEntry(ctx, inv.journalEntryId, { reason: `Void invoice ${inv.invoiceNumber}: ${reason}` });
  const updated = await prisma.salesInvoice.update({ where: { id }, data: { status: "void", amountDue: ZERO } });
  await audit(ctx, { action: "invoice.voided", entityType: "SalesInvoice", entityId: id, summary: `${inv.invoiceNumber} voided: ${reason}`, companyId: inv.companyId });
  return updated;
}

// ---------------------------------------------------------------------------
// Credit notes
// ---------------------------------------------------------------------------
export async function listCreditNotes(principal: Principal, companyId: string, raw: unknown = {}) {
  assertCan(principal, "ar.view", { companyId });
  const q = invoiceQuerySchema.parse(raw);
  const where: Prisma.CreditNoteWhereInput = { companyId, archivedAt: null, ...(q.status ? { status: q.status } : {}), ...(q.customerId ? { customerId: q.customerId } : {}) };
  const [rows, total] = await Promise.all([
    prisma.creditNote.findMany({ where, orderBy: { issueDate: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { customer: { select: { name: true } } } }),
    prisma.creditNote.count({ where }),
  ]);
  return { rows, total, page: q.page, pageSize: q.pageSize };
}

export async function getCreditNote(principal: Principal, id: string) {
  const cn = await prisma.creditNote.findUnique({ where: { id }, include: { customer: true, lines: { orderBy: { lineNo: "asc" } }, applications: { include: { invoice: { select: { invoiceNumber: true } } } } } });
  if (!cn) return null;
  if (!canFinance(principal, "ar.view", cn.companyId)) throw new ServiceError("forbidden", "Forbidden", 403);
  return cn;
}

export async function createCreditNote(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "ar.create", { companyId });
  const input = creditNoteSchema.parse(raw);
  const settings = await requireSettings(companyId);
  const customer = await loadCustomerForWrite(companyId, input.customerId);
  const currency = (input.currency ?? customer.currency ?? settings.baseCurrency).toUpperCase();
  const { computed, subtotal, taxTotal, total } = await computeLines(companyId, currency, input.lines, input);

  const cn = await prisma.creditNote.create({
    data: {
      companyId, customerId: customer.id, status: "draft", issueDate: input.issueDate, currency, baseCurrency: settings.baseCurrency,
      subtotal, taxTotal, total, amountRemaining: total, amountApplied: ZERO,
      brandId: input.brandId ?? customer.brandId ?? null, countryId: input.countryId ?? customer.countryId ?? null,
      reason: input.reason ?? null, reference: input.reference ?? null, createdById: ctx.principal.userId,
      lines: { create: computed.map((c, i) => ({ lineNo: i + 1, description: c.description, quantity: c.quantity, unitPrice: c.unitPrice, lineNet: c.lineNet, taxRateId: c.taxRateId, taxAmount: c.taxAmount, revenueAccountId: c.revenueAccountId, ...c.dims })) },
    },
    include: { lines: true },
  });
  await audit(ctx, { action: "credit_note.created", entityType: "CreditNote", entityId: cn.id, summary: `Draft credit note ${customer.name} ${total} ${currency}`, companyId });
  return cn;
}

/** Issue (post) a credit note: Dr Revenue / Dr Output Tax / Cr Receivable — mirror of the invoice. */
export async function issueCreditNote(ctx: ActorContext, id: string) {
  const cn = await prisma.creditNote.findUnique({ where: { id }, include: { lines: { orderBy: { lineNo: "asc" } }, customer: true } });
  if (!cn || cn.archivedAt) throw new ServiceError("not_found", "Credit note not found", 404);
  assertCan(ctx.principal, "ar.create", { companyId: cn.companyId });
  if (cn.status !== "draft") throw new ServiceError("not_draft", "Only a draft credit note can be issued.", 422);
  if (isZero(cn.total)) throw new ServiceError("empty", "Cannot issue a zero-total credit note.", 422);
  const settings = await requireSettings(cn.companyId);
  const receivableAccountId = cn.customer.receivableAccountId ?? settings.receivableAccountId;
  if (!receivableAccountId) throw new ServiceError("no_receivable_account", "No receivable account configured.", 422);
  const rate = cn.currency === cn.baseCurrency ? 1 : await resolveExchangeRate(cn.currency, cn.baseCurrency, cn.issueDate);

  const taxIds = [...new Set(cn.lines.map((l) => l.taxRateId).filter((x): x is string => !!x))];
  const taxRates = taxIds.length ? await prisma.taxRate.findMany({ where: { id: { in: taxIds } } }) : [];
  const taxAcctById = new Map(taxRates.map((t) => [t.id, t.outputTaxAccountId]));

  const jl: Record<string, unknown>[] = [];
  for (const l of cn.lines) {
    if (gt(l.lineNet, 0)) {
      if (!l.revenueAccountId) throw new ServiceError("no_revenue_account", "No revenue account for a line.", 422);
      jl.push({ accountId: l.revenueAccountId, debit: Number(l.lineNet), credit: 0, customerId: cn.customerId, productId: l.productId ?? undefined, brandId: l.brandId ?? undefined, countryId: l.countryId ?? undefined, departmentId: l.departmentId ?? undefined, campaignId: l.campaignId ?? undefined, storeId: l.storeId ?? undefined, costCenterId: l.costCenterId ?? undefined, description: l.description });
    }
  }
  const taxByAccount = new Map<string, Prisma.Decimal>();
  for (const l of cn.lines) {
    if (gt(l.taxAmount, 0)) {
      const acct = (l.taxRateId ? taxAcctById.get(l.taxRateId) : null) ?? settings.outputTaxAccountId;
      if (!acct) throw new ServiceError("no_tax_account", "No output tax account configured.", 422);
      taxByAccount.set(acct, add(taxByAccount.get(acct) ?? ZERO, l.taxAmount));
    }
  }
  for (const [accountId, amount] of taxByAccount) jl.push({ accountId, debit: Number(amount), credit: 0, customerId: cn.customerId, description: "Output tax reversal" });
  jl.push({ accountId: receivableAccountId, debit: 0, credit: Number(cn.total), customerId: cn.customerId, brandId: cn.brandId ?? undefined, countryId: cn.countryId ?? undefined, description: cn.customer.name });

  const journalRaw = { companyId: cn.companyId, journalCode: "SJ", date: cn.issueDate, currency: cn.currency, exchangeRate: rate === 1 ? undefined : rate, reference: cn.reference ?? undefined, memo: `Credit note ${cn.customer.name}${cn.reason ? `: ${cn.reason}` : ""}`, sourceType: "CreditNote", sourceId: cn.id, lines: jl };
  const { input, prepared, postingDate, periodId } = await prepareForPost(ctx, journalRaw);

  const updated = await prisma.$transaction(async (tx) => {
    const number = await allocateNumber(tx, { companyId: cn.companyId, key: "credit_note", prefix: `${settings.invoicePrefix}CN`, year: cn.issueDate.getFullYear() });
    const entry = await writePostedEntry(tx, ctx, input, prepared, postingDate, periodId);
    return tx.creditNote.update({ where: { id }, data: { status: "issued", creditNoteNumber: number, journalEntryId: entry.id, exchangeRate: D(rate), totalBase: prepared.totalCredit, postedById: ctx.principal.userId, postedAt: new Date() } });
  });
  await audit(ctx, { action: "credit_note.issued", entityType: "CreditNote", entityId: id, summary: `${updated.creditNoteNumber} ${cn.customer.name} ${cn.total} ${cn.currency}`, companyId: cn.companyId });
  return updated;
}

/** Apply an issued credit note against one or more open invoices (sub-ledger contra; no new GL). */
export async function applyCreditNote(ctx: ActorContext, creditNoteId: string, allocations: { invoiceId: string; amount: number }[]) {
  const cn = await prisma.creditNote.findUnique({ where: { id: creditNoteId } });
  if (!cn) throw new ServiceError("not_found", "Credit note not found", 404);
  assertCan(ctx.principal, "ar.create", { companyId: cn.companyId });
  if (cn.status !== "issued" && cn.status !== "applied") throw new ServiceError("not_issued", "Credit note must be issued before applying.", 422);
  if (!allocations.length) throw new ServiceError("empty", "No allocations provided.", 422);

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.creditNote.findUnique({ where: { id: creditNoteId } });
    if (!fresh) throw new ServiceError("not_found", "Credit note not found", 404);
    let remaining = D(fresh.amountRemaining);
    for (const a of allocations) {
      const amt = roundMoney(a.amount, cn.currency);
      if (!gt(amt, 0)) continue;
      if (gt(amt, remaining)) throw new ServiceError("over_apply", "Allocation exceeds the credit note's remaining balance.", 422);
      const inv = await tx.salesInvoice.findUnique({ where: { id: a.invoiceId } });
      if (!inv || inv.companyId !== cn.companyId || inv.customerId !== cn.customerId) throw new ServiceError("bad_invoice", "Invoice not found for this customer.", 422);
      if (!["issued", "partially_paid"].includes(inv.status)) throw new ServiceError("not_open", "Invoice is not open.", 422);
      if (gt(amt, inv.amountDue)) throw new ServiceError("over_apply", "Allocation exceeds the invoice balance due.", 422);
      await tx.creditNoteApplication.upsert({ where: { creditNoteId_invoiceId: { creditNoteId, invoiceId: a.invoiceId } }, create: { creditNoteId, invoiceId: a.invoiceId, amount: amt }, update: { amount: { increment: amt } } });
      const newPaid = add(inv.amountPaid, amt), newDue = sub(inv.amountDue, amt);
      await tx.salesInvoice.update({ where: { id: a.invoiceId }, data: { amountPaid: newPaid, amountDue: newDue, status: isZero(newDue) ? "paid" : "partially_paid" } });
      remaining = sub(remaining, amt);
    }
    const applied = sub(cn.total, remaining);
    await tx.creditNote.update({ where: { id: creditNoteId }, data: { amountApplied: applied, amountRemaining: remaining, status: isZero(remaining) ? "applied" : "issued" } });
  });
  await audit(ctx, { action: "credit_note.applied", entityType: "CreditNote", entityId: creditNoteId, summary: `Applied ${cn.creditNoteNumber}`, companyId: cn.companyId });
}

// ---------------------------------------------------------------------------
// Customer receipts
// ---------------------------------------------------------------------------
export const receiptSchema = z.object({
  customerId: z.string().min(1),
  receiptDate: z.coerce.date(),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3).optional(),
  method: z.enum(["bank", "cash", "card", "cheque", "transfer"]).default("bank"),
  bankAccountId: optionalString,
  reference: optionalString,
  notes: optionalString,
  brandId: optionalString,
  countryId: optionalString,
  allocations: z.array(z.object({ invoiceId: z.string().min(1), amount: z.coerce.number().positive() })).default([]),
});

export async function listReceipts(principal: Principal, companyId: string, raw: unknown = {}) {
  assertCan(principal, "payments.view", { companyId });
  const q = invoiceQuerySchema.parse(raw);
  const where: Prisma.CustomerReceiptWhereInput = { companyId, archivedAt: null, ...(q.status ? { status: q.status } : {}), ...(q.customerId ? { customerId: q.customerId } : {}) };
  const [rows, total] = await Promise.all([
    prisma.customerReceipt.findMany({ where, orderBy: { receiptDate: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { customer: { select: { name: true } } } }),
    prisma.customerReceipt.count({ where }),
  ]);
  return { rows, total, page: q.page, pageSize: q.pageSize };
}

export async function getReceipt(principal: Principal, id: string) {
  const r = await prisma.customerReceipt.findUnique({ where: { id }, include: { customer: true, allocations: { include: { invoice: { select: { invoiceNumber: true, total: true } } } } } });
  if (!r) return null;
  if (!canFinance(principal, "payments.view", r.companyId)) throw new ServiceError("forbidden", "Forbidden", 403);
  return r;
}

/**
 * Record + post a customer receipt: Dr Bank/Cash · Cr Receivable, allocated to open
 * invoices. GL post, allocation rows and invoice updates are one atomic
 * transaction with no over-allocation.
 */
export async function postReceipt(ctx: ActorContext, companyId: string, raw: unknown) {
  assertCan(ctx.principal, "payments.create", { companyId });
  const input = receiptSchema.parse(raw);
  const settings = await requireSettings(companyId);
  const customer = await loadCustomerForWrite(companyId, input.customerId);
  const currency = (input.currency ?? customer.currency ?? settings.baseCurrency).toUpperCase();
  const amount = roundMoney(input.amount, currency);
  const rate = currency === settings.baseCurrency ? 1 : await resolveExchangeRate(currency, settings.baseCurrency, input.receiptDate);

  const depositAccountId = input.bankAccountId ?? settings.cashAccountId ?? settings.bankClearingAccountId;
  const receivableAccountId = customer.receivableAccountId ?? settings.receivableAccountId;
  if (!depositAccountId) throw new ServiceError("no_cash_account", "No cash/bank account configured for receipts.", 422);
  if (!receivableAccountId) throw new ServiceError("no_receivable_account", "No receivable account configured.", 422);

  // Validate allocations sum ≤ amount up-front (fail fast).
  let allocTotal = ZERO;
  for (const a of input.allocations) allocTotal = add(allocTotal, roundMoney(a.amount, currency));
  if (gt(allocTotal, amount)) throw new ServiceError("over_allocate", "Allocations exceed the receipt amount.", 422);

  const journalRaw = {
    companyId, journalCode: "CJ", date: input.receiptDate, currency, exchangeRate: rate === 1 ? undefined : rate,
    reference: input.reference ?? undefined, memo: `Receipt ${customer.name}`, sourceType: "CustomerReceipt", sourceId: "pending",
    lines: [
      { accountId: depositAccountId, debit: Number(amount), credit: 0, customerId: customer.id, brandId: input.brandId ?? undefined, countryId: input.countryId ?? undefined, description: `Receipt ${customer.name}` },
      { accountId: receivableAccountId, debit: 0, credit: Number(amount), customerId: customer.id, brandId: input.brandId ?? undefined, countryId: input.countryId ?? undefined, description: customer.name },
    ],
  };
  const { input: jInput, prepared, postingDate, periodId } = await prepareForPost(ctx, journalRaw);

  const receipt = await prisma.$transaction(async (tx) => {
    const number = await allocateNumber(tx, { companyId, key: "receipt", prefix: settings.paymentPrefix, year: input.receiptDate.getFullYear() });
    const rec = await tx.customerReceipt.create({
      data: {
        companyId, customerId: customer.id, status: "posted", receiptNumber: number, receiptDate: input.receiptDate,
        currency, baseCurrency: settings.baseCurrency, exchangeRate: D(rate), amount, amountBase: prepared.totalDebit,
        allocatedAmount: allocTotal, unappliedAmount: sub(amount, allocTotal),
        bankAccountId: input.bankAccountId ?? null, method: input.method, reference: input.reference ?? null, notes: input.notes ?? null,
        brandId: input.brandId ?? null, countryId: input.countryId ?? null, postedById: ctx.principal.userId, postedAt: new Date(),
        createdById: ctx.principal.userId,
      },
    });
    const entry = await writePostedEntry(tx, { ...ctx }, { ...jInput, sourceId: rec.id }, prepared, postingDate, periodId);
    const withEntry = await tx.customerReceipt.update({ where: { id: rec.id }, data: { journalEntryId: entry.id } });
    // Apply allocations.
    for (const a of input.allocations) {
      const amt = roundMoney(a.amount, currency);
      if (!gt(amt, 0)) continue;
      const inv = await tx.salesInvoice.findUnique({ where: { id: a.invoiceId } });
      if (!inv || inv.companyId !== companyId || inv.customerId !== customer.id) throw new ServiceError("bad_invoice", "Invoice not found for this customer.", 422);
      if (!["issued", "partially_paid"].includes(inv.status)) throw new ServiceError("not_open", `Invoice ${inv.invoiceNumber} is not open.`, 422);
      if (gt(amt, inv.amountDue)) throw new ServiceError("over_allocate", `Allocation exceeds invoice ${inv.invoiceNumber} balance.`, 422);
      await tx.receiptAllocation.create({ data: { receiptId: rec.id, invoiceId: a.invoiceId, amount: amt } });
      const newDue = sub(inv.amountDue, amt);
      await tx.salesInvoice.update({ where: { id: a.invoiceId }, data: { amountPaid: add(inv.amountPaid, amt), amountDue: newDue, status: isZero(newDue) ? "paid" : "partially_paid" } });
    }
    return withEntry;
  });
  await audit(ctx, { action: "receipt.posted", entityType: "CustomerReceipt", entityId: receipt.id, summary: `${receipt.receiptNumber} ${customer.name} ${amount} ${currency}`, companyId });
  return receipt;
}

/** Allocate a posted receipt's unapplied balance to additional open invoices. */
export async function allocateReceipt(ctx: ActorContext, receiptId: string, allocations: { invoiceId: string; amount: number }[]) {
  const rec = await prisma.customerReceipt.findUnique({ where: { id: receiptId } });
  if (!rec) throw new ServiceError("not_found", "Receipt not found", 404);
  assertCan(ctx.principal, "payments.create", { companyId: rec.companyId });
  if (rec.status !== "posted") throw new ServiceError("not_posted", "Receipt is not posted.", 422);

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.customerReceipt.findUnique({ where: { id: receiptId } });
    if (!fresh) throw new ServiceError("not_found", "Receipt not found", 404);
    let unapplied = D(fresh.unappliedAmount);
    for (const a of allocations) {
      const amt = roundMoney(a.amount, rec.currency);
      if (!gt(amt, 0)) continue;
      if (gt(amt, unapplied)) throw new ServiceError("over_allocate", "Allocation exceeds the receipt's unapplied balance.", 422);
      const inv = await tx.salesInvoice.findUnique({ where: { id: a.invoiceId } });
      if (!inv || inv.companyId !== rec.companyId || inv.customerId !== rec.customerId) throw new ServiceError("bad_invoice", "Invoice not found for this customer.", 422);
      if (!["issued", "partially_paid"].includes(inv.status)) throw new ServiceError("not_open", "Invoice is not open.", 422);
      if (gt(amt, inv.amountDue)) throw new ServiceError("over_allocate", "Allocation exceeds invoice balance.", 422);
      await tx.receiptAllocation.upsert({ where: { receiptId_invoiceId: { receiptId, invoiceId: a.invoiceId } }, create: { receiptId, invoiceId: a.invoiceId, amount: amt }, update: { amount: { increment: amt } } });
      const newDue = sub(inv.amountDue, amt);
      await tx.salesInvoice.update({ where: { id: a.invoiceId }, data: { amountPaid: add(inv.amountPaid, amt), amountDue: newDue, status: isZero(newDue) ? "paid" : "partially_paid" } });
      unapplied = sub(unapplied, amt);
    }
    await tx.customerReceipt.update({ where: { id: receiptId }, data: { unappliedAmount: unapplied, allocatedAmount: sub(rec.amount, unapplied) } });
  });
  await audit(ctx, { action: "receipt.allocated", entityType: "CustomerReceipt", entityId: receiptId, summary: `Allocated ${rec.receiptNumber}`, companyId: rec.companyId });
}

// ---------------------------------------------------------------------------
// AR reports
// ---------------------------------------------------------------------------
const AGING_BUCKETS = [30, 60, 90] as const;

/** AR aging as of a date: open invoice balances bucketed by days overdue. */
export async function arAging(principal: Principal, companyId: string, asOf: Date = new Date()) {
  assertCan(principal, "ar.view", { companyId });
  const invoices = await prisma.salesInvoice.findMany({
    where: { companyId, archivedAt: null, status: { in: ["issued", "partially_paid"] }, issueDate: { lte: asOf } },
    select: { id: true, invoiceNumber: true, customerId: true, dueDate: true, issueDate: true, amountDue: true, currency: true, customer: { select: { name: true } } },
  });
  const byCustomer = new Map<string, { customerId: string; name: string; current: Prisma.Decimal; d30: Prisma.Decimal; d60: Prisma.Decimal; d90: Prisma.Decimal; older: Prisma.Decimal; total: Prisma.Decimal }>();
  for (const inv of invoices) {
    const due = inv.dueDate ?? inv.issueDate;
    const days = Math.floor((asOf.getTime() - due.getTime()) / 86400000);
    const row = byCustomer.get(inv.customerId) ?? { customerId: inv.customerId, name: inv.customer.name, current: ZERO, d30: ZERO, d60: ZERO, d90: ZERO, older: ZERO, total: ZERO };
    const amt = D(inv.amountDue);
    if (days <= 0) row.current = add(row.current, amt);
    else if (days <= AGING_BUCKETS[0]) row.d30 = add(row.d30, amt);
    else if (days <= AGING_BUCKETS[1]) row.d60 = add(row.d60, amt);
    else if (days <= AGING_BUCKETS[2]) row.d90 = add(row.d90, amt);
    else row.older = add(row.older, amt);
    row.total = add(row.total, amt);
    byCustomer.set(inv.customerId, row);
  }
  const rows = [...byCustomer.values()].sort((a, b) => (gt(b.total, a.total) ? 1 : -1));
  const totals = rows.reduce((t, r) => ({ current: add(t.current, r.current), d30: add(t.d30, r.d30), d60: add(t.d60, r.d60), d90: add(t.d90, r.d90), older: add(t.older, r.older), total: add(t.total, r.total) }), { current: ZERO, d30: ZERO, d60: ZERO, d90: ZERO, older: ZERO, total: ZERO });
  return { asOf, rows, totals };
}

/** A customer statement: chronological invoices, credit notes and receipts with running balance. */
export async function customerStatement(principal: Principal, companyId: string, customerId: string, from?: Date, to: Date = new Date()) {
  assertCan(principal, "ar.view", { companyId });
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || (customer.companyId && customer.companyId !== companyId)) throw new ServiceError("not_found", "Customer not found", 404);

  const [invoices, credits, receipts] = await Promise.all([
    prisma.salesInvoice.findMany({ where: { companyId, customerId, status: { notIn: ["draft", "void"] }, issueDate: { lte: to, ...(from ? { gte: from } : {}) } }, select: { invoiceNumber: true, issueDate: true, total: true, currency: true } }),
    prisma.creditNote.findMany({ where: { companyId, customerId, status: { notIn: ["draft", "void"] }, issueDate: { lte: to, ...(from ? { gte: from } : {}) } }, select: { creditNoteNumber: true, issueDate: true, total: true, currency: true } }),
    prisma.customerReceipt.findMany({ where: { companyId, customerId, status: "posted", receiptDate: { lte: to, ...(from ? { gte: from } : {}) } }, select: { receiptNumber: true, receiptDate: true, amount: true, currency: true } }),
  ]);
  type Row = { date: Date; type: string; ref: string; debit: Prisma.Decimal; credit: Prisma.Decimal; currency: string };
  const rows: Row[] = [
    ...invoices.map((i) => ({ date: i.issueDate, type: "Invoice", ref: i.invoiceNumber ?? "—", debit: D(i.total), credit: ZERO, currency: i.currency })),
    ...credits.map((c) => ({ date: c.issueDate, type: "Credit Note", ref: c.creditNoteNumber ?? "—", debit: ZERO, credit: D(c.total), currency: c.currency })),
    ...receipts.map((r) => ({ date: r.receiptDate, type: "Receipt", ref: r.receiptNumber ?? "—", debit: ZERO, credit: D(r.amount), currency: r.currency })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  let balance = ZERO;
  const withBalance = rows.map((r) => { balance = add(sub(balance, r.credit), r.debit); return { ...r, balance }; });
  return { customer, from, to, rows: withBalance, closingBalance: balance };
}

export { isNeg };
