/**
 * NEXORA OS — realistic multi-company / multi-brand demo world (§67).
 * Seeds several legal companies, brands spanning companies, countries/markets,
 * departments, teams, scoped users (the §3 example + §69 security-test subjects),
 * products, campaigns, tasks, daily checks, registrations, certificates, cases,
 * subscriptions, attendance, notifications and audit — so the real multi-tenant
 * architecture can be validated, not a single-company happy path.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { DEFAULT_ROLES, allPermissionKeys } from "../src/lib/permissions/catalog";

const prisma = new PrismaClient();

const now = new Date();
const day = 86_400_000;
const d = (n: number) => new Date(now.getTime() + n * day);
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

async function clear() {
  // Delete in an order that respects FKs (children first). Dev-only reset.
  const tables = [
    "auditLog", "notification", "notificationPreference", "systemEvent", "backgroundJob",
    "featureRegistry", "systemSetting", "apiToken", "recentItem", "favorite", "savedView",
    "workflowTransitionLog", "workflowInstance", "workflowVersion", "workflowDefinition",
    "workflowTemplate", "statusDefinition",
    "journalLine", "journalEntry", "account", "accountingPeriod", "fiscalYear", "bankAccount",
    "costCenter", "invoice", "payment", "customer", "supplier", "budget", "expense",
    "expenseCategory", "exchangeRate", "taxRate", "subscription",
    "approvalStep", "approvalRequest",
    "messageMention", "message", "channelMember", "channel", "reaction", "comment",
    "knowledgeArticle", "answerRequest", "approvedAnswer",
    "customerCaseNote", "customerCase",
    "storePerformance", "storeResponsible", "store",
    "creativeAsset", "designVersion", "designRequest", "whatsappCampaign",
    "publishingRecurrence", "publishingItem", "socialAccount",
    "campaignReport", "campaignMetric", "campaignProduct", "campaign",
    "holiday", "leaveRequest", "attendanceEvent", "attendanceRecord", "workSchedule",
    "checklistInstanceItem", "checklistInstance", "checklistAssignment",
    "checklistTemplateItem", "checklistTemplate",
    "taskDependency", "taskChecklistItem", "taskAssignee", "task", "project",
    "fileVersion", "file", "folder",
    "document", "documentType",
    "registrationDocReq", "registrationEvent", "registrationCase", "registrationType", "regulatoryAuthority",
    "productClaim", "productMarket", "productVariant", "product",
    "employeeCountry", "employeeBrand", "employee", "teamMember", "team", "department",
    "brandMarket", "brandCompany", "brand", "country", "company",
    "roleAssignment", "rolePermission", "role", "session", "user",
  ];
  for (const t of tables) {
    // @ts-expect-error dynamic model access for the reset routine
    await prisma[t].deleteMany({});
  }
}

/**
 * Seed guard (Phase 2, Part B): demo data — including the well-known demo
 * password — must never be created against a production database. Running the
 * seed in production requires an explicit, deliberate override.
 */
function assertSeedAllowed() {
  const isProd = process.env.NODE_ENV === "production";
  const url = process.env.DATABASE_URL ?? "";
  const looksProd = /(^|@)(?!.*(localhost|127\.0\.0\.1|::1))/.test(url) && !url.startsWith("file:");
  const override = process.env.NEXORA_ALLOW_SEED === "true";
  if ((isProd || looksProd) && !override) {
    throw new Error(
      "REFUSING TO SEED: NODE_ENV=production or DATABASE_URL points at a non-local host. " +
        "The demo seed (with the shared demo password) is development-only. " +
        "If you REALLY intend to seed this database, set NEXORA_ALLOW_SEED=true explicitly.",
    );
  }
}

async function main() {
  assertSeedAllowed();
  console.log("• Resetting database…");
  await clear();

  const password = await hashPassword("password");

  // ---------------------------------------------------------------- Countries
  console.log("• Countries / markets");
  const countryData = [
    { name: "Kuwait", iso2: "KW", iso3: "KWT", currency: "KWD", timezone: "Asia/Kuwait", region: "GCC", phoneCode: "+965" },
    { name: "United Arab Emirates", iso2: "AE", iso3: "ARE", currency: "AED", timezone: "Asia/Dubai", region: "GCC", phoneCode: "+971" },
    { name: "Saudi Arabia", iso2: "SA", iso3: "SAU", currency: "SAR", timezone: "Asia/Riyadh", region: "GCC", phoneCode: "+966" },
    { name: "Qatar", iso2: "QA", iso3: "QAT", currency: "QAR", timezone: "Asia/Qatar", region: "GCC", phoneCode: "+974" },
    { name: "Bahrain", iso2: "BH", iso3: "BHR", currency: "BHD", timezone: "Asia/Bahrain", region: "GCC", phoneCode: "+973" },
    { name: "Oman", iso2: "OM", iso3: "OMN", currency: "OMR", timezone: "Asia/Muscat", region: "GCC", phoneCode: "+968" },
  ];
  const countries: Record<string, string> = {};
  for (const c of countryData) {
    const row = await prisma.country.create({ data: c });
    countries[c.iso2] = row.id;
  }

  // ---------------------------------------------------------------- Companies
  console.log("• Companies");
  const pcc = await prisma.company.create({
    data: { name: "PremierCare Cosmetics", legalName: "PremierCare Cosmetics Co. W.L.L.", code: "PCC", baseCurrency: "KWD", hqCountryId: countries.KW, timezone: "Asia/Kuwait", fiscalYearStartMonth: 1, logoColor: "#6c5aa0" },
  });
  const lbt = await prisma.company.create({
    data: { name: "Lumière Beauty Trading", legalName: "Lumière Beauty Trading LLC", code: "LBT", baseCurrency: "AED", hqCountryId: countries.AE, timezone: "Asia/Dubai", fiscalYearStartMonth: 1, logoColor: "#9c6ab0" },
  });
  const dlx = await prisma.company.create({
    data: { name: "DermaLux Medical", legalName: "DermaLux Medical Cosmetics Est.", code: "DLX", baseCurrency: "SAR", hqCountryId: countries.SA, timezone: "Asia/Riyadh", fiscalYearStartMonth: 1, logoColor: "#3f78b5" },
  });

  // ------------------------------------------------------------------- Brands
  console.log("• Brands (spanning companies)");
  const lumiere = await prisma.brand.create({ data: { name: "Lumière", code: "LUM", slug: "lumiere", description: "Luxury skincare and radiance.", primaryCompanyId: lbt.id, accentColor: "#6c5aa0" } });
  const derma = await prisma.brand.create({ data: { name: "Derma+", code: "DRM", slug: "derma-plus", description: "Medical-grade dermocosmetics.", primaryCompanyId: dlx.id, accentColor: "#3f78b5" } });
  const solara = await prisma.brand.create({ data: { name: "Solara", code: "SOL", slug: "solara", description: "Advanced sun care.", primaryCompanyId: pcc.id, accentColor: "#b5852f" } });
  const veloura = await prisma.brand.create({ data: { name: "Veloura", code: "VEL", slug: "veloura", description: "Colour cosmetics.", primaryCompanyId: lbt.id, accentColor: "#bd524c" } });

  // Brand ↔ company links (a brand may belong to more than one legal company, §2)
  await prisma.brandCompany.createMany({
    data: [
      { brandId: lumiere.id, companyId: lbt.id, isPrimary: true },
      { brandId: lumiere.id, companyId: pcc.id, isPrimary: false },
      { brandId: derma.id, companyId: dlx.id, isPrimary: true },
      { brandId: solara.id, companyId: pcc.id, isPrimary: true },
      { brandId: veloura.id, companyId: lbt.id, isPrimary: true },
      { brandId: veloura.id, companyId: pcc.id, isPrimary: false },
    ],
  });

  // Brand ↔ market links
  const brandMarkets: { brandId: string; countryId: string; status: string }[] = [];
  const addMarket = (brandId: string, isos: string[], status = "active") =>
    isos.forEach((iso) => brandMarkets.push({ brandId, countryId: countries[iso], status }));
  addMarket(lumiere.id, ["KW", "AE", "SA", "QA"]);
  addMarket(derma.id, ["SA", "AE", "KW"]);
  addMarket(solara.id, ["KW", "AE", "BH", "OM"]);
  addMarket(veloura.id, ["AE", "KW"]);
  await prisma.brandMarket.createMany({ data: brandMarkets });

  // -------------------------------------------------------------- Departments
  console.log("• Departments & teams");
  const deptDefs = [
    { name: "Marketing", code: "MKT" },
    { name: "Creative & Design", code: "CRE" },
    { name: "Regulatory Affairs", code: "REG" },
    { name: "Customer Service", code: "CS" },
    { name: "Commerce", code: "COM" },
    { name: "Finance", code: "FIN" },
    { name: "Management", code: "MGT" },
  ];
  const depts: Record<string, string> = {};
  for (const dd of deptDefs) {
    const row = await prisma.department.create({ data: { name: dd.name, code: dd.code, companyId: pcc.id } });
    depts[dd.code] = row.id;
  }

  // ------------------------------------------------------------------- Roles
  console.log("• Roles & permissions");
  const roleIds: Record<string, string> = {};
  for (const rd of DEFAULT_ROLES) {
    const role = await prisma.role.create({ data: { key: rd.key, name: rd.name, description: rd.description, isSystem: rd.isSystem } });
    roleIds[rd.key] = role.id;
    const keys = rd.permissions.includes("*") ? ["*", ...rd.permissions.filter((p) => p !== "*")] : rd.permissions;
    await prisma.rolePermission.createMany({ data: [...new Set(keys)].map((permissionKey) => ({ roleId: role.id, permissionKey })) });
  }

  // ------------------------------------------------------------------- Users
  console.log("• Users (scoped assignments)");
  interface AssignmentSpec { role: string; companyId?: string; brandId?: string; countryId?: string; departmentId?: string; }
  async function createUser(opts: {
    email: string; name: string; title?: string; isSuperAdmin?: boolean; locale?: string; avatarColor?: string;
    companyId?: string; departmentId?: string; assignments: AssignmentSpec[]; brands?: string[]; countries?: string[]; position?: string;
  }) {
    const user = await prisma.user.create({
      data: {
        email: opts.email, name: opts.name, passwordHash: password, isSuperAdmin: opts.isSuperAdmin ?? false,
        locale: opts.locale ?? "en", title: opts.title, avatarColor: opts.avatarColor, lastLoginAt: d(-1),
      },
    });
    const employee = await prisma.employee.create({
      data: { userId: user.id, companyId: opts.companyId, departmentId: opts.departmentId, position: opts.position ?? opts.title, joinDate: d(-400), employmentStatus: "active" },
    });
    if (opts.brands?.length) await prisma.employeeBrand.createMany({ data: opts.brands.map((brandId) => ({ employeeId: employee.id, brandId })) });
    if (opts.countries?.length) await prisma.employeeCountry.createMany({ data: opts.countries.map((countryId) => ({ employeeId: employee.id, countryId })) });
    for (const a of opts.assignments) {
      await prisma.roleAssignment.create({
        data: { userId: user.id, roleId: roleIds[a.role], companyId: a.companyId ?? null, brandId: a.brandId ?? null, countryId: a.countryId ?? null, departmentId: a.departmentId ?? null },
      });
    }
    return { user, employee };
  }

  const admin = await createUser({ email: "admin@nexora.group", name: "System Administrator", title: "Super Admin", isSuperAdmin: true, avatarColor: "#201e1b", departmentId: depts.MGT, assignments: [{ role: "super_admin" }] });
  const layla = await createUser({ email: "layla.management@nexora.group", name: "Layla Al-Sabah", title: "Group General Manager", avatarColor: "#6c5aa0", companyId: pcc.id, departmentId: depts.MGT, assignments: [{ role: "group_management" }] });
  // §3 example + §69 test subject: Marketing Manager for Lumière, in Kuwait AND UAE only.
  const omar = await createUser({
    email: "omar.marketing@nexora.group", name: "Omar Haddad", title: "Marketing Manager", avatarColor: "#9c6ab0",
    companyId: lbt.id, departmentId: depts.MKT, brands: [lumiere.id], countries: [countries.KW, countries.AE],
    assignments: [
      { role: "marketing_manager", brandId: lumiere.id, countryId: countries.KW },
      { role: "marketing_manager", brandId: lumiere.id, countryId: countries.AE },
    ],
  });
  // §69 contrast subject: Marketing Employee for Derma+, Saudi only.
  const noura = await createUser({
    email: "noura.marketing.sa@nexora.group", name: "Noura Al-Otaibi", title: "Marketing Executive", avatarColor: "#3f78b5",
    companyId: dlx.id, departmentId: depts.MKT, brands: [derma.id], countries: [countries.SA],
    assignments: [{ role: "marketing_employee", brandId: derma.id, countryId: countries.SA }],
  });
  const sara = await createUser({
    email: "sara.regulatory@nexora.group", name: "Sara Mansour", title: "Regulatory Specialist", avatarColor: "#4a9268",
    companyId: dlx.id, departmentId: depts.REG, brands: [derma.id, lumiere.id],
    assignments: [{ role: "regulatory_specialist", brandId: derma.id }, { role: "regulatory_specialist", brandId: lumiere.id }],
  });
  const dana = await createUser({
    email: "dana.design@nexora.group", name: "Dana Khalil", title: "Senior Designer", avatarColor: "#b5852f",
    companyId: lbt.id, departmentId: depts.CRE, assignments: [{ role: "designer" }],
  });
  const hana = await createUser({
    email: "hana.cs@nexora.group", name: "Hana Youssef", title: "Customer Service Agent", avatarColor: "#bd524c",
    companyId: lbt.id, departmentId: depts.CS, brands: [lumiere.id], countries: [countries.KW],
    assignments: [{ role: "customer_service", brandId: lumiere.id, countryId: countries.KW }],
  });
  const yousef = await createUser({
    email: "yousef.finance@nexora.group", name: "Yousef Rahman", title: "Finance Manager", avatarColor: "#3f78b5",
    companyId: pcc.id, departmentId: depts.FIN, assignments: [{ role: "finance_manager", companyId: pcc.id }],
  });

  // Teams
  const mktTeam = await prisma.team.create({ data: { name: "Marketing — GCC", departmentId: depts.MKT, brandId: lumiere.id, leadUserId: omar.user.id } });
  const designTeam = await prisma.team.create({ data: { name: "Creative Studio", departmentId: depts.CRE, leadUserId: dana.user.id } });
  await prisma.teamMember.createMany({
    data: [
      { teamId: mktTeam.id, userId: omar.user.id, role: "lead" },
      { teamId: mktTeam.id, userId: noura.user.id, role: "member" },
      { teamId: designTeam.id, userId: dana.user.id, role: "lead" },
    ],
  });

  // ----------------------------------------------------------------- Products
  console.log("• Products");
  const productDefs = [
    { brand: lumiere.id, name: "Radiance Renewal Serum", sku: "LUM-SER-001", category: "Serum", markets: ["KW", "AE", "SA"] },
    { brand: lumiere.id, name: "Hydra Boost Cream", sku: "LUM-CRM-002", category: "Moisturizer", markets: ["KW", "AE"] },
    { brand: lumiere.id, name: "Gentle Milk Cleanser", sku: "LUM-CLN-003", category: "Cleanser", markets: ["KW", "AE", "QA"] },
    { brand: derma.id, name: "Acne Control Gel", sku: "DRM-GEL-001", category: "Treatment", markets: ["SA", "AE"] },
    { brand: derma.id, name: "Barrier Repair Cream", sku: "DRM-CRM-002", category: "Treatment", markets: ["SA", "KW"] },
    { brand: solara.id, name: "Invisible Fluid SPF50+", sku: "SOL-SPF-001", category: "Sun care", markets: ["KW", "AE", "BH"] },
    { brand: solara.id, name: "After-Sun Recovery Gel", sku: "SOL-GEL-002", category: "Sun care", markets: ["KW", "OM"] },
    { brand: veloura.id, name: "Velvet Matte Lipstick", sku: "VEL-LIP-001", category: "Lips", markets: ["AE", "KW"] },
    { brand: veloura.id, name: "Silk Second-Skin Foundation", sku: "VEL-FDN-002", category: "Face", markets: ["AE"] },
  ];
  const products: { id: string; brandId: string; name: string }[] = [];
  for (const p of productDefs) {
    const row = await prisma.product.create({ data: { brandId: p.brand, name: p.name, sku: p.sku, category: p.category, status: "active", launchDate: d(-200) } });
    products.push({ id: row.id, brandId: p.brand, name: p.name });
    await prisma.productMarket.createMany({ data: p.markets.map((iso) => ({ productId: row.id, countryId: countries[iso], status: "active" })) });
  }

  // ----------------------------------------------------------------- Campaigns
  console.log("• Campaigns");
  const campaignDefs = [
    { name: "Lumière Ramadan Radiance — KW", brand: lumiere.id, country: countries.KW, company: lbt.id, type: "instagram", status: "live", owner: omar.user.id, budget: 8500, spend: 5200 },
    { name: "Lumière Summer Glow — UAE", brand: lumiere.id, country: countries.AE, company: lbt.id, type: "meta", status: "monitoring", owner: omar.user.id, budget: 12000, spend: 11200 },
    { name: "Derma+ Clear Skin Challenge — SA", brand: derma.id, country: countries.SA, company: dlx.id, type: "tiktok", status: "planning", owner: noura.user.id, budget: 15000, spend: 0 },
    { name: "Solara Beach Season — KW", brand: solara.id, country: countries.KW, company: pcc.id, type: "snapchat", status: "completed", owner: layla.user.id, budget: 6000, spend: 5850 },
    { name: "Veloura Matte Launch — UAE", brand: veloura.id, country: countries.AE, company: lbt.id, type: "influencer", status: "waiting_creative", owner: omar.user.id, budget: 20000, spend: 3000 },
  ];
  const campaigns: { id: string; brandId: string; name: string }[] = [];
  for (const c of campaignDefs) {
    const row = await prisma.campaign.create({
      data: {
        name: c.name, brandId: c.brand, countryId: c.country, companyId: c.company, type: c.type, status: c.status,
        ownerId: c.owner, currency: "KWD", plannedBudget: new Prisma.Decimal(c.budget), actualSpend: new Prisma.Decimal(c.spend),
        startDate: d(-20), endDate: d(20), objective: "Awareness & conversions",
      },
    });
    campaigns.push({ id: row.id, brandId: c.brand, name: c.name });
    if (c.spend > 0) {
      await prisma.campaignMetric.createMany({
        data: [
          { campaignId: row.id, name: "spend", value: new Prisma.Decimal(c.spend) },
          { campaignId: row.id, name: "impressions", value: new Prisma.Decimal(c.spend * 210) },
          { campaignId: row.id, name: "clicks", value: new Prisma.Decimal(Math.round(c.spend * 3.4)) },
          { campaignId: row.id, name: "orders", value: new Prisma.Decimal(Math.round(c.spend / 22)) },
          { campaignId: row.id, name: "revenue", value: new Prisma.Decimal(Math.round(c.spend * 2.6)) },
        ],
      });
    }
  }

  // -------------------------------------------------------------------- Tasks
  console.log("• Tasks");
  const taskDefs = [
    { title: "Finalize Ramadan creative brief", owner: omar.user.id, brand: lumiere.id, country: countries.KW, campaign: campaigns[0].id, status: "in_progress", priority: "high", due: d(-1) },
    { title: "Approve UAE summer ad set", owner: omar.user.id, brand: lumiere.id, country: countries.AE, campaign: campaigns[1].id, status: "review", priority: "urgent", due: d(0) },
    { title: "Prepare Derma+ TikTok scripts", owner: noura.user.id, brand: derma.id, country: countries.SA, campaign: campaigns[2].id, status: "todo", priority: "normal", due: d(2) },
    { title: "Collect Solara post-campaign report", owner: layla.user.id, brand: solara.id, country: countries.KW, campaign: campaigns[3].id, status: "blocked", priority: "high", due: d(-3) },
    { title: "Renew Lumière free-sale certificate (SA)", owner: sara.user.id, brand: lumiere.id, country: countries.SA, status: "todo", priority: "high", due: d(5) },
    { title: "Design Veloura launch key visual", owner: dana.user.id, brand: veloura.id, country: countries.AE, campaign: campaigns[4].id, status: "in_progress", priority: "high", due: d(1) },
  ];
  for (const t of taskDefs) {
    const task = await prisma.task.create({
      data: {
        title: t.title, ownerId: t.owner, brandId: t.brand, countryId: t.country, campaignId: t.campaign ?? null,
        status: t.status, priority: t.priority, dueDate: t.due, startDate: d(-5),
        completedAt: t.status === "completed" ? d(-1) : null,
      },
    });
    await prisma.taskAssignee.create({ data: { taskId: task.id, userId: t.owner, role: "assignee" } });
  }

  // -------------------------------------------------------------- Daily checks
  console.log("• Daily checks");
  const socialTemplate = await prisma.checklistTemplate.create({
    data: {
      name: "Daily Social Media Checks — Lumière KW", brandId: lumiere.id, departmentId: depts.MKT, scheduleType: "daily",
      items: {
        create: [
          { text: "Verify today's Instagram post is live", order: 1, requiresLink: true },
          { text: "Verify today's Story is published", order: 2, requiresAttachment: true },
          { text: "Check TikTok scheduling for tomorrow", order: 3 },
          { text: "Review and respond to comments", order: 4, requiresNote: true },
          { text: "Check campaign delivery status", order: 5 },
        ],
      },
    },
    include: { items: true },
  });
  await prisma.checklistAssignment.create({ data: { templateId: socialTemplate.id, userId: omar.user.id, startDate: d(-30), isActive: true } });
  const todayInstance = await prisma.checklistInstance.create({
    data: {
      templateId: socialTemplate.id, userId: omar.user.id, date: startOfToday, status: "pending",
      items: { create: socialTemplate.items.map((it, i) => ({ templateItemId: it.id, text: it.text, isDone: i < 2, doneAt: i < 2 ? now : null })) },
    },
  });
  void todayInstance;

  // -------------------------------------------------------------- Regulatory
  console.log("• Regulatory registrations");
  const sfda = await prisma.regulatoryAuthority.create({ data: { name: "Saudi Food & Drug Authority", countryId: countries.SA, code: "SFDA" } });
  const moh = await prisma.regulatoryAuthority.create({ data: { name: "Kuwait Ministry of Health", countryId: countries.KW, code: "MOH-KW" } });
  const regDefs = [
    { product: products[3].id, brand: derma.id, company: dlx.id, country: countries.SA, authority: sfda.id, status: "authority_review", assigned: sara.user.id, num: "SFDA-2025-00841" },
    { product: products[4].id, brand: derma.id, company: dlx.id, country: countries.SA, authority: sfda.id, status: "documents_missing", assigned: sara.user.id, num: null },
    { product: products[0].id, brand: lumiere.id, company: lbt.id, country: countries.KW, authority: moh.id, status: "registered", assigned: sara.user.id, num: "MOH-KW-33120", expiry: d(120) },
    { product: products[1].id, brand: lumiere.id, company: lbt.id, country: countries.KW, authority: moh.id, status: "payment_required", assigned: sara.user.id, num: null },
  ];
  for (const r of regDefs) {
    const reg = await prisma.registrationCase.create({
      data: {
        productId: r.product, brandId: r.brand, companyId: r.company, countryId: r.country, authorityId: r.authority,
        registrationNumber: r.num, status: r.status, assignedToId: r.assigned, submissionDate: d(-40),
        expiryDate: r.expiry ?? null, expectedCompletion: d(30),
      },
    });
    await prisma.registrationEvent.create({ data: { caseId: reg.id, type: "created", title: "Case opened", actorId: r.assigned, createdAt: d(-40) } });
    await prisma.registrationEvent.create({ data: { caseId: reg.id, type: "status", title: `Moved to ${r.status.replace(/_/g, " ")}`, actorId: r.assigned, createdAt: d(-5) } });
  }

  // ------------------------------------------------------- Documents / certs
  console.log("• Documents & certificates");
  const dtFree = await prisma.documentType.create({ data: { name: "Free Sale Certificate", code: "FSC", category: "regulatory", defaultValidityDays: 365 } });
  const dtGmp = await prisma.documentType.create({ data: { name: "GMP Certificate", code: "GMP", category: "regulatory", defaultValidityDays: 730 } });
  const docDefs = [
    { type: dtFree.id, brand: lumiere.id, company: lbt.id, country: countries.KW, title: "Lumière Free Sale Certificate — KW", expiry: d(18), status: "expiring" },
    { type: dtGmp.id, brand: derma.id, company: dlx.id, country: countries.SA, title: "Derma+ GMP Certificate", expiry: d(210), status: "valid" },
    { type: dtFree.id, brand: solara.id, company: pcc.id, country: countries.KW, title: "Solara Free Sale Certificate — KW", expiry: d(-6), status: "expired" },
    { type: dtFree.id, brand: veloura.id, company: lbt.id, country: countries.AE, title: "Veloura Free Sale Certificate — UAE", expiry: d(75), status: "valid" },
  ];
  for (const doc of docDefs) {
    await prisma.document.create({ data: { documentTypeId: doc.type, brandId: doc.brand, companyId: doc.company, countryId: doc.country, title: doc.title, issueDate: d(-350), expiryDate: doc.expiry, status: doc.status, visibility: "restricted", number: "DOC-" + Math.round(Math.abs(doc.expiry.getTime() / 1000) % 100000) } });
  }

  // ----------------------------------------------------------- Customer cases
  console.log("• Customer cases & approved answers");
  const caseDefs = [
    { brand: lumiere.id, country: countries.KW, type: "product_question", priority: "normal", status: "in_progress", assigned: hana.user.id, desc: "Is the Radiance Serum suitable for sensitive skin?" },
    { brand: lumiere.id, country: countries.KW, type: "complaint", priority: "high", status: "escalated", assigned: hana.user.id, desc: "Received a damaged Hydra Boost jar." },
    { brand: derma.id, country: countries.SA, type: "return", priority: "normal", status: "new", assigned: null, desc: "Customer requests return of Acne Control Gel." },
  ];
  for (const c of caseDefs) {
    await prisma.customerCase.create({ data: { brandId: c.brand, countryId: c.country, type: c.type, priority: c.priority, status: c.status, assignedToId: c.assigned, description: c.desc, updatedAt: d(-3) } });
  }
  await prisma.approvedAnswer.createMany({
    data: [
      { question: "Is the Radiance Renewal Serum suitable for sensitive skin?", answer: "Yes. The Radiance Renewal Serum is formulated without alcohol or synthetic fragrance and is suitable for sensitive skin. We recommend a patch test before first use.", brandId: lumiere.id, category: "Product info", language: "en", status: "approved", approvedById: layla.user.id, effectiveDate: d(-60) },
      { question: "What is the return policy for online orders?", answer: "Unopened products may be returned within 14 days of delivery for a full refund. Opened products can only be returned if defective.", category: "Policy", language: "en", status: "approved", approvedById: layla.user.id, effectiveDate: d(-90) },
    ],
  });

  // ------------------------------------------------------------ Subscriptions
  console.log("• Subscriptions, stores & finance");
  await prisma.subscription.createMany({
    data: [
      { provider: "Shopify Plus", companyId: lbt.id, brandId: lumiere.id, plan: "Plus", currency: "USD", cost: new Prisma.Decimal(2000), billingCycle: "monthly", renewalDate: d(12), status: "active", ownerId: yousef.user.id },
      { provider: "Meta Business Suite", companyId: lbt.id, plan: "—", currency: "USD", cost: new Prisma.Decimal(0), billingCycle: "monthly", renewalDate: d(45), status: "active" },
      { provider: "Adobe Creative Cloud", companyId: lbt.id, plan: "Teams (5 seats)", currency: "USD", cost: new Prisma.Decimal(350), billingCycle: "monthly", renewalDate: d(4), status: "active", licenses: 5, ownerId: dana.user.id },
      { provider: "lumiere.com domain", companyId: lbt.id, plan: "Annual", currency: "USD", cost: new Prisma.Decimal(24), billingCycle: "yearly", renewalDate: d(-2), status: "expiring" },
    ],
  });

  // Stores + one performance row
  const store = await prisma.store.create({ data: { companyId: lbt.id, brandId: lumiere.id, countryId: countries.AE, platform: "shopify", name: "Lumière UAE Store", currency: "AED", url: "https://lumiere.example.ae", status: "active" } });
  await prisma.storePerformance.create({ data: { storeId: store.id, periodType: "monthly", periodStart: d(-30), periodEnd: now, sales: new Prisma.Decimal(184000), orders: 1240, unitsSold: 2980, returns: 41, aov: new Prisma.Decimal(148), adSpend: new Prisma.Decimal(31000), cogs: new Prisma.Decimal(62000), grossMargin: new Prisma.Decimal(122000) } });

  // Minimal finance foundation for one company
  const fy = await prisma.fiscalYear.create({ data: { companyId: pcc.id, name: "FY2025", startDate: new Date(2025, 0, 1), endDate: new Date(2025, 11, 31), status: "open" } });
  await prisma.accountingPeriod.create({ data: { fiscalYearId: fy.id, name: "2025", startDate: new Date(2025, 0, 1), endDate: new Date(2025, 11, 31), status: "open" } });
  const coa = [
    { code: "1000", name: "Cash & Bank", type: "asset" },
    { code: "1100", name: "Accounts Receivable", type: "asset" },
    { code: "2000", name: "Accounts Payable", type: "liability" },
    { code: "3000", name: "Equity", type: "equity" },
    { code: "4000", name: "Revenue", type: "income" },
    { code: "5000", name: "Marketing Expense", type: "expense" },
    { code: "5100", name: "Cost of Goods Sold", type: "expense" },
  ];
  for (const a of coa) await prisma.account.create({ data: { companyId: pcc.id, code: a.code, name: a.name, type: a.type } });

  // ------------------------------------------------------------- Attendance
  console.log("• Attendance (today)");
  await prisma.attendanceRecord.createMany({
    data: [
      { userId: omar.user.id, date: startOfToday, expectedStart: new Date(startOfToday.getTime() + 9 * 3600000), actualStart: new Date(startOfToday.getTime() + 9 * 3600000 + 12 * 60000), lateMinutes: 12, status: "late" },
      { userId: hana.user.id, date: startOfToday, expectedStart: new Date(startOfToday.getTime() + 9 * 3600000), actualStart: new Date(startOfToday.getTime() + 8.9 * 3600000), status: "present" },
      { userId: dana.user.id, date: startOfToday, status: "present", actualStart: new Date(startOfToday.getTime() + 9.1 * 3600000) },
    ],
  });

  // ----------------------------------------------------------- Notifications
  await prisma.notification.createMany({
    data: [
      { userId: omar.user.id, type: "task.due", title: "Task due today", body: "Approve UAE summer ad set", entityType: "Task", state: "unread" },
      { userId: layla.user.id, type: "cert.expiring", title: "Certificate expiring soon", body: "Lumière Free Sale Certificate — KW expires in 18 days", entityType: "Document", state: "unread" },
      { userId: sara.user.id, type: "reg.update", title: "Registration blocked", body: "Barrier Repair Cream — documents missing", entityType: "RegistrationCase", state: "unread" },
    ],
  });

  // ------------------------------------------------------------- Status defs
  console.log("• Configuration (statuses, feature registry, jobs)");
  const statusSeed: { module: string; key: string; label: string; category: string; order: number }[] = [];
  const push = (module: string, entries: [string, string, string][]) =>
    entries.forEach(([key, label, category], i) => statusSeed.push({ module, key, label, category, order: i }));
  push("task", [["backlog", "Backlog", "neutral"], ["todo", "To do", "neutral"], ["in_progress", "In progress", "info"], ["blocked", "Blocked", "critical"], ["review", "Review", "info"], ["completed", "Completed", "success"], ["cancelled", "Cancelled", "neutral"]]);
  push("campaign", [["draft", "Draft", "neutral"], ["planning", "Planning", "neutral"], ["waiting_creative", "Waiting for creative", "warning"], ["live", "Live", "success"], ["monitoring", "Monitoring", "info"], ["completed", "Completed", "success"]]);
  await prisma.statusDefinition.createMany({ data: statusSeed });

  // Feature registry (§34) + background jobs (§37) — visibility, no hidden systems
  await prisma.featureRegistry.createMany({
    data: [
      { key: "tasks", name: "Tasks", module: "work", webAvailable: true, mobileApiAvailable: true, permissionKey: "tasks.view", endpoint: "/api/v1/tasks", status: "available" },
      { key: "campaigns", name: "Campaigns", module: "marketing", webAvailable: true, mobileApiAvailable: true, permissionKey: "campaigns.view", endpoint: "/api/v1/campaigns", status: "available" },
      { key: "registrations", name: "Registrations", module: "regulatory", webAvailable: true, mobileApiAvailable: true, permissionKey: "registrations.view", endpoint: "/api/v1/registrations", status: "available" },
      { key: "attendance", name: "Attendance", module: "work", webAvailable: true, mobileApiAvailable: false, permissionKey: "attendance.view", endpoint: "/api/v1/attendance", status: "planned" },
    ],
  });
  await prisma.backgroundJob.createMany({
    data: [
      { name: "Generate recurring daily checks", type: "recurring", status: "success", scheduleCron: "0 0 * * *", lastRunAt: startOfToday, nextRunAt: d(1) },
      { name: "Certificate expiry reminders", type: "recurring", status: "success", scheduleCron: "0 6 * * *", lastRunAt: startOfToday, nextRunAt: d(1) },
      { name: "Subscription renewal reminders", type: "recurring", status: "success", scheduleCron: "0 7 * * *", lastRunAt: startOfToday, nextRunAt: d(1) },
      { id: "workflow-escalations", name: "Workflow SLA escalations", type: "recurring", status: "success", scheduleCron: "0 * * * *", lastRunAt: startOfToday, nextRunAt: d(1) },
      { name: "Notification digest delivery", type: "queue", status: "running", lastRunAt: now },
    ],
  });

  // Configurable Workflow Engine (§26–27) — a real, active, versioned workflow
  // that governs regulatory registrations, so the engine ships with a worked
  // example rather than an empty admin screen.
  console.log("• Workflow engine (registration approval)");
  const registrationWorkflowSpec = {
    stages: [
      { key: "preparation", name: "Preparation", category: "neutral", isInitial: true, slaHours: 72, responsibleRoles: ["regulatory_specialist"], requiredDocuments: ["dossier"] },
      { key: "documents_review", name: "Documents Review", category: "info", slaHours: 48, responsibleRoles: ["regulatory_specialist"] },
      { key: "submitted", name: "Submitted to Authority", category: "info", slaHours: 24, responsibleRoles: ["regulatory_specialist"] },
      { key: "authority_review", name: "Authority Review", category: "warning", slaHours: 720, responsibleRoles: ["regulatory_specialist"], escalation: { afterHours: 720, toRoles: ["group_management"], note: "Authority review is overdue — escalate." } },
      { key: "approved", name: "Approved", category: "success", isTerminal: true },
      { key: "rejected", name: "Rejected", category: "critical", isTerminal: true },
    ],
    transitions: [
      { key: "start_review", name: "Send to documents review", from: "preparation", to: "documents_review", permission: "registrations.edit" },
      { key: "submit", name: "Submit to authority", from: "documents_review", to: "submitted", permission: "registrations.edit" },
      { key: "return_to_prep", name: "Return for more documents", from: "documents_review", to: "preparation", permission: "registrations.edit" },
      { key: "under_review", name: "Mark under authority review", from: "submitted", to: "authority_review", permission: "registrations.edit" },
      { key: "approve", name: "Record approval", from: "authority_review", to: "approved", permission: "registrations.edit" },
      { key: "reject", name: "Record rejection", from: "authority_review", to: "rejected", permission: "registrations.edit" },
    ],
  };
  const regWorkflow = await prisma.workflowDefinition.create({
    data: { key: "registration_approval", name: "Product Registration Approval", module: "registrations", description: "Standard regulatory registration lifecycle from dossier preparation to authority decision.", status: "active", createdById: admin.user.id },
  });
  const regWorkflowVersion = await prisma.workflowVersion.create({
    data: { definitionId: regWorkflow.id, version: 1, status: "active", definitionJson: JSON.stringify(registrationWorkflowSpec), changeNote: "Initial published version", activatedAt: now, activatedById: admin.user.id, createdById: admin.user.id },
  });
  await prisma.workflowDefinition.update({ where: { id: regWorkflow.id }, data: { currentVersionId: regWorkflowVersion.id } });
  await prisma.systemSetting.createMany({
    data: [
      { key: "group.name", valueJson: JSON.stringify("PremierCare Group"), category: "general" },
      { key: "group.defaultCurrency", valueJson: JSON.stringify("KWD"), category: "finance" },
      { key: "notifications.digest", valueJson: JSON.stringify({ enabled: true, hour: 8 }), category: "notifications" },
    ],
  });

  // ------------------------------------------------------------------ Audit
  await prisma.auditLog.createMany({
    data: [
      { actorId: admin.user.id, action: "seed.bootstrap", entityType: "System", summary: "Demo world seeded" },
      { actorId: layla.user.id, action: "answer.approved", entityType: "ApprovedAnswer", summary: "Approved 'return policy' answer" },
      { actorId: sara.user.id, action: "registration.status_changed", entityType: "RegistrationCase", summary: "Derma+ SFDA case → authority review" },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    companies: await prisma.company.count(),
    brands: await prisma.brand.count(),
    products: await prisma.product.count(),
    campaigns: await prisma.campaign.count(),
    tasks: await prisma.task.count(),
  };
  console.log("✔ Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
