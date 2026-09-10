# NEXORA OS — تقرير المطابقة مع ملف المتطلبات
### Spec Coverage Report — Master Build Script vs. What Was Built

> تقرير صادق يقارن كل قسم من الأقسام الـ81 في *Master Build Script* بما تم تنفيذه فعليًا في هذه الجلسة.
> A candid, section-by-section comparison of the 81-section brief against the delivered code.
>
> **الفرع / Branch:** `claude/phase-2-write-paths` · **تاريخ / Date:** 2026-09-09 · **آخر تحديث / Updated:** بعد المرحلة 2 (مسارات الكتابة)

---

## ملخص تنفيذي (Executive summary)

بُنِيت **الأساس الكامل (Phase 1)** الذي يطلبه الملف صراحةً في القسمين 70 و81 — "ابنِ المنصة المشتركة أولًا بشكل صحيح" — إضافةً إلى **تغطية عرضية واسعة لكل الوحدات التشغيلية** (قوائم + صفحات تفصيل + خدمات + واجهة REST). كل شاشة موصولة ببيانات حقيقية، والصلاحيات مُطبَّقة من جهة الخادم، واختبار الأمان الحرج (§69) يعمل ومُتحقَّق منه على بيانات فعلية.

**ما هو مكتمل بقوة:** النموذج العلائقي الكامل، محرك الصلاحيات RBAC + النطاقات (Company/Brand/Country/Department/Team)، مصفوفة الصلاحيات + مُختبِر الصلاحيات، البنية API-first، نظام التصميم (فاتح/داكن + عربي RTL)، مركز القيادة، يومي، وحدة المؤسسة (شركات/علامات/أسواق/فرق/موظفون)، والتدقيق.

**ما تغيّر في المرحلة 2:** أصبحت **مسارات الكتابة التشغيلية كاملة وموصولة من الطرف إلى الطرف** (واجهة → إجراء خادم → خدمة نطاق → `/api/v1` → صلاحية بالنطاق → تحقّق → معاملة → تدقيق → إشعار → نشاط)، متحقَّقًا منها حيًّا على PostgreSQL: المهام، الفحوصات اليومية (+مولّد)، الموافقات، الحضور، حالات العملاء، التسجيلات، إدارة الصلاحيات من الواجهة، الحملات، أداء المتاجر، النشر الاجتماعي (+تغطية+تكرار)، واتساب، والتصميم (اعتماد الإصدارات). كما انتقل المشروع إلى **PostgreSQL بترحيلات مُصدَّرة** و**CI**.

**ما تبقّى جزئيًا (طور 2.5 القادم):** طبقة **التعاون والمعرفة والملفات** — منصّة الملفات الحقيقية والإصدارات، النقاشات الداخلية، مكتبة الأجوبة المعتمدة، قاعدة المعرفة، ترقية "يومي"، الإشعارات 2.0، الاشتراكات والتذكيرات، حلقة تصحيح الحضور، وباني سير العمل — تمتد كلها على نفس الأساس دون إعادة تصميم. والمحاسبة الكاملة (§26) هي الطور المخصّص الذي يليها.

### مفتاح الحالات (Legend)
| الرمز | المعنى |
|------|--------|
| ✅ | **مكتمل** — منفّذ ويعمل (واجهة + خدمة + نطاق + بيانات حقيقية) |
| 🟡 | **جزئي** — القراءة/القائمة/التفاصيل جاهزة؛ مسارات الكتابة/الميزات المتقدمة لاحقًا |
| 🧩 | **البنية + الـAPI جاهزة** — مُنمذَج في المخطط والخدمات؛ واجهة مخصصة لاحقًا |
| ⬜ | **لم يبدأ بعد** |

### إحصاء تقريبي (Approximate tally — بعد المرحلة 2)
- ✅ مكتمل: **~43 قسمًا** (الأساس، الصلاحيات + إدارتها من الواجهة، التصميم، التنقل، مركز القيادة، **كل مسارات الكتابة التشغيلية**: المهام/الفحوصات/الموافقات/الحضور/الحالات/التسجيلات/الحملات/المتاجر/النشر/واتساب/التصميم، الأمان الأساسي، التدقيق، الأرشفة، API-first، الترحيلات + CI، اللغتان، بيانات العرض، اختبار §69، …)
- 🟡 جزئي: **~22 قسمًا** (طبقة التعاون/المعرفة/الملفات — قيد التنفيذ في الطور 2.5: يومي 2.0، الإشعارات، الاشتراكات، تصحيح الحضور، …)
- 🧩 بنية جاهزة: **~13 قسمًا** (المحاسبة، محرك سير العمل، النقاشات، الملفات، التقارير، المفضلة/العروض المحفوظة، التعليقات، …)
- ⬜ لم يبدأ: **~3 أقسام** (الاستيراد/التصدير، وبعض عناصر التخصيص المتقدمة)

> **تحديث الطور 3 (المحاسبة والذكاء المالي):** §26 أصبح ✅ مكتملًا ومُتحقَّقًا — محرك
> قيد مزدوج + الذمم المدينة/الدائنة + المصروفات + البنك/FX + الميزانيات + البيانات المالية
> + الذكاء المالي، على نفس الأساس (الصلاحيات/التدقيق/الوظائف/الملفات/الـAPI). §38 (Rate
> limiting) و§1 أصبحا ✅. **التحقق الحالي:** `typecheck` 0 أخطاء · `build` ناجح ·
> `test` **141/141** · 6 هجرات محاسبية مُطبَّقة · ميزان المراجعة والميزانية العمومية
> متوازنان على بيانات العرض. الحكم على الجاهزية في `ACCOUNTING_SYSTEM_AUDIT.md` (§116):
> **جاهز للاستخدام الإنتاجي المُتحكَّم به** دون أي عائق P0/P1.

---

## Phase 2 — Production Hardening & Write Paths (status)

Phase 2 turned NEXORA from a read-oriented surface into an **operable** system, and
hardened the repository for production. A write path is ✅ only when **UI + mutation
+ service + API + permission + validation + transaction + audit + real persistence**
all work (verified end-to-end on PostgreSQL), per the brief's own bar.

| Part | Area | Status | Notes |
|------|------|:------:|-------|
| A | Freeze Phase 1 (`main`) + `claude/phase-2-write-paths` | ✅ | Stable baseline branch; all Phase-2 work isolated. |
| B | Security / repo hygiene | ✅ | `.env` untracked + gitignored; `.env.example` only. Production **fails startup** on missing/placeholder/short `NEXORA_SESSION_SECRET` (via `instrumentation.ts`). Seed refuses to run against production/non-local DB unless `NEXORA_ALLOW_SEED=true`. |
| C | PostgreSQL + migrations | ✅ | Single DB for dev + prod (no SQLite). Versioned migration in `prisma/migrations`; `migrate deploy` is the path (no `db push`). `docker-compose.yml` for local. Case-insensitive search. Verified: **clean-DB migrate + seed** works. |
| D | CI quality gate | ✅ | GitHub Actions: `npm ci` → prisma generate → **migrate deploy on a clean Postgres service** → typecheck → tests → build. |
| F | Universal action/form foundation | ✅ | `runAction`/`ActorContext`, `mutation.ts` (audit/notify/activity), `ActionForm` (per-field validation, dirty-guard, toasts), `Drawer`, `ToastProvider`, `ActivityTimeline`, scoped form `options`. |
| **G** | **Tasks** write path | ✅ | create/edit/status/assign/checklist/subtask/dependency/archive. Verified. |
| **H** | **Daily Check execution** | ✅ | complete-item (required note/evidence), submit, verify; own-instance only. Verified. |
| **I** | **Daily Check generator** | ✅ | Real, idempotent, schedule-aware, logged in System Jobs, retryable. Verified. |
| **J** | **Approval engine** | ✅ | Sequential multi-step; immutable history; approve/reject/changes/cancel. Verified. |
| **Q** | **Customer Cases** write path | ✅ | create/assign/status/escalate/resolve/notes. Verified. |
| **R** | **Regulatory** write path | ✅ | stage transitions write the event timeline; requirements; authority responses. Verified. |
| **S** | **Attendance** clock | ✅ | check-in/break/back/check-out state machine with validated transitions + computed durations. Verified. |
| **X** | **Permission administration** | ✅ | create/edit roles, scoped assignments + expiry, remove; **no privilege escalation** (scope-bounded, super-admin protected); all audited. Verified. |
| T | Audit everything | ✅* | Every implemented mutation audits (create/edit/status/assign/approval/attendance/registration/permission changes) and is readable in the Audit Explorer. *Grows with each remaining write path. |
| U | API parity | ✅ | Every implemented action is exposed under `/api/v1` sharing the exact domain logic. The §30 sweep closed the remaining web-only lifecycle/edit/sub-entity writes (status transitions, cancel/archive, draft edits & revisions, requirements, notes, attachments, message edit/delete/pin/react, per-item checks) so no business logic is reachable from the web UI alone (89 route files). |
| V | Transactions & concurrency | ✅ | Multi-record ops (task+assignees+checklist, approval decisions, registration stage+event, break accounting, role+permissions) run in `prisma.$transaction`; generator + dependencies are idempotent/guarded. |
| **K** | **Marketing Campaign** write path | ✅ | create/edit (drawer), lifecycle transitions, manual metrics with atomic spend roll-up into the budget, activity timeline. Combined-dimension scope (brand + country) enforced on create + IDOR edit. Verified live on Postgres + unit tests. |
| **L,M** | **Social publishing** actions + recurring | ✅ | plan/edit items (drawer), workflow stages, two verification checkpoints (confirm-scheduled requires *approved*; confirm-published requires *scheduled*, captures the public URL), a **platform × 7-day coverage matrix**, a detail page with activity, and an **idempotent recurring generator** (job route + per-recurrence, never duplicates a date). Brand + country scope enforced. Verified live on Postgres + unit tests. |
| **N** | **WhatsApp** workflow | ✅ | brief → creative → review → approved → ready → sent → reported, with **validated transitions** (no skipping), an **approval gate** (`whatsapp.approve`, scoped — managers approve, employees don't), mark-sent (records send time), and a results capture (delivered/read/replied/conversions) that moves it to reported. Detail page + activity. Brand + country scope enforced. Verified live on Postgres + unit tests. |
| **O** | **Creative request** lifecycle + version approval | ✅ | brief → assigned → designing → internal review → (revision loop) → waiting approval → approved → delivered → published, with **validated transitions**; **append-only versions** (server-assigned numbers, never overwritten); per-version **approve/reject** gated by `design.approve` (scoped) where a new approval **supersedes** the prior one (exactly one approved version, all rows preserved); closed to new versions once delivered/published. Detail page + activity. Company/brand/country scope enforced. Verified live on Postgres + unit tests. |
| **P** | **Store performance** entry | ✅ | daily/weekly/monthly figures entry (drawer) with server-computed AOV / gross margin / net contribution; idempotent upsert per (store, period-type, period-start); scoped to the store's company/brand/country via `sales.create`; audited. Verified live on Postgres + unit tests. |
| W | UX quality | ✅ | Drawers, inline controls, toasts, dirty-guard, activity timelines, validation — premium; RTL + dark verified across the foundation. |
| Y | Accounting UI deferred | ✅ | Schema + dimensions preserved; no accounting UI built this phase (as instructed). |
| Z | Verification + tests + coverage | ✅ | typecheck + build + 47 tests (incl. mutation-authorization suite) + clean-DB migration + seed; each write path verified live on Postgres. This document updated. |

**Changelog (this phase):** branches (A) → security hardening (B) → PostgreSQL + migrations (C) → CI (D) → action/form foundation (F) → Tasks (G) → Daily Checks + generator (H,I) → Approvals (J) → Attendance (S) → Customer Cases (Q) → Regulatory (R) → Permission administration (X) → verification (Z) → Marketing Campaigns (K) → Store performance (P) → Social publishing + coverage + recurrence (L,M) → WhatsApp workflow (N) → Creative lifecycle + version approval (O). Each shipped as its own commit with an end-to-end Postgres verification.

**All Phase-2 write paths (A–Z, K–P) are now complete.** **Remaining longer-term work, in priority order:** employee-initiated attendance-correction approval loop; file uploads to object storage (§21/§52); the configurable Workflow engine UI (§50); the full accounting posting + statements (§26, the dedicated next phase per Part Y); rate-limiting + MFA (§38).

---

## المقارنة التفصيلية (Section-by-section)

| # | Section (from brief) | Status | ملاحظات / Notes |
|---|----------------------|:------:|------------------|
| 1 | Do not build disconnected modules | ✅ | مخطط علائقي بالكامل؛ chips علائقية، صفحات 360، `getLookups`/`refName`. |
| 2 | Organizational hierarchy | ✅ | Company/Brand/Country/Department/Team/Employee؛ علامة قد تتبع أكثر من شركة عبر `BrandCompany`. لا حدود صلبة. |
| 3 | Permissions (RBAC + scope) — **critical** | ✅ | محرك خالص مختبَر (`can`/`scopeWhereFor`/`assertRecordInScope`)، تطبيق على API+خادم، مصفوفة + مُختبِر صلاحيات. **تحرير الأدوار وإسنادها بالنطاق + انتهاء صلاحية + إزالة من الواجهة (Part X) — بلا تصعيد صلاحية، محميّ super-admin، كل تغيير مُدقَّق.** |
| 4 | Global navigation | ✅ | كامل التنقل §4، يتكيّف مع الصلاحيات. |
| 5 | Command Center | ✅ | Needs Attention / Live Ops / Pulse ببيانات حقيقية ضمن النطاق. *الفلترة بالشركة/العلامة/الدولة/التاريخ داخل الصفحة لاحقًا.* |
| 6 | My Day | ✅ | **يومي 2.0**: مهام/فحوصات/موافقات/مواعيد/حضور + إشارات غير مقروءة + حالاتي + طلبات التصميم المُسندة لي + حملاتي + نشر مستحق اليوم + إجراءات التسجيل + تجديدات قادمة + عدّاد نقاشات غير مقروءة — كله بنطاق المستخدم (ملكية/إسناد). |
| 7 | Universal Task Engine | ✅ | مسار كتابة كامل: إنشاء/تعديل/حالة/إسناد/قائمة تحقّق/مهام فرعية/تبعيات/أرشفة (Part G) + قائمة/تفاصيل/نشاط. الحالات قابلة للتهيئة عبر `StatusDefinition`. *توليد المهام المتكررة من قالب = وظيفة خلفية لاحقة.* |
| 8 | Daily Check System | ✅ | تنفيذ الفحص بالأدلة (ملاحظة/إثبات مطلوب) + إرسال + موافقة المشرف (لِنُسخي فقط) + **مولّد يومي حتمي/idempotent مسجَّل في وظائف النظام** (Parts H,I). |
| 9 | Marketing Campaigns | ✅ | مسار كتابة كامل (Part K): إنشاء/تعديل + دورة حياة + مقاييس يدوية مع تجميع الإنفاق ذريًّا في الميزانية + نشاط. نطاق مركّب (علامة+دولة) مُطبَّق. *تكاملات API الخارجية خارج النطاق (مطابق).* |
| 10 | Social Publishing Control | ✅ | تخطيط/تعديل + مراحل + **نقطتا تحقّق (مُجدول ثم منشور برابط)** + **مصفوفة تغطية منصّة×٧أيام** + **مولّد نشر متكرر idempotent** (Parts L,M). ليست ناشرًا عبر API (مطابق). |
| 11 | WhatsApp Campaigns | ✅ | سير عمل داخلي كامل brief→sent→reported بانتقالات مُتحقَّقة + **بوابة اعتماد بالنطاق** + تسجيل الإرسال + التقاط النتائج (Part N). لا إرسال عبر API (مطابق). |
| 12 | Creative / Design | ✅ | دورة حياة كاملة + **إصدارات append-only مرقّمة من الخادم** + اعتماد/رفض لكل إصدار حيث يَجُبّ الاعتمادُ الأحدثُ السابقَ (نسخة معتمدة واحدة، حفظ التاريخ) (Part O). *رفع ملف الإصدار الحقيقي في الطور 2.5 §6.* |
| 13 | Products (Master + 360) | ✅ | Product Master + صفحة 360، و**CRUD كامل الآن (تدقيق §7)**: إنشاء/تعديل/أرشفة المنتج + المتغيّرات + توفّر الأسواق + الادعاءات (باعتماد)، بالنطاق ومُدقَّق، مع مسارات `/api/v1` كاملة. |
| 14 | Global Regulatory Registration | ✅ | مسار كتابة كامل (Part R): انتقالات المراحل تكتب خطًّا زمنيًّا للأحداث + المتطلبات + ردود السلطات، بالنطاق ومُدقَّق. **مربوط الآن بمحرّك سير العمل القابل للتهيئة (§26–27)** عبر `WorkflowPanel` + سير عمل "اعتماد التسجيل" المُفعّل في البذور. |
| 15 | Certificate & Document Expiration | ✅ | `Document` + تتبّع انتهاء + إبراز في مركز القيادة، و**وظيفة تذكير idempotent بعتبات قابلة للتهيئة** (`certificates.reminderThresholds`، افتراضيًا 180/120/90/60/30/14/7/1) مربوطة بالمجدول وبـ`/api/v1/jobs/certificate-reminders/run` (تدقيق §22). |
| 16 | E-commerce Stores | ✅ | مسار كتابة كامل (Part P): إدخال أداء يومي/أسبوعي/شهري بحساب AOV/هامش إجمالي/مساهمة صافية من الخادم + upsert idempotent لكل فترة + بالنطاق ومُدقَّق. |
| 17 | Customer Service | ✅ | مسار كتابة كامل (Part Q): إنشاء/إسناد/حالة/تصعيد/حل/ملاحظات + نشاط. *تكامل مكتبة الأجوبة داخل الحالة في الطور 2.5 §17.* |
| 18 | Approved Answer Library | 🟡 | `ApprovedAnswer` + `AnswerRequest` + قائمة + إصدار/حالة. *بحث/نسخ/طلب جواب جديد + مسار الاعتماد لاحقًا.* |
| 19 | Internal Knowledge Base | 🟡 | `KnowledgeArticle` + قائمة. *عرض/تحرير/إصدارات المقالة لاحقًا.* |
| 20 | Internal Discussions | 🧩 | `Channel/Message/Member/Mention` + قائمة القنوات. *الدردشة والتحويل إلى مهمة/حالة/موافقة + التفاعلات/التثبيت لاحقًا.* |
| 21 | File Management | ✅ | منصّة ملفات حقيقية (رفع/إصدارات/مرفقات/تقييد) خلف تجريد `StorageDriver`، مع **سائق S3 إنتاجي (تدقيق §11)**: توقيع SigV4 بلا اعتمادية + روابط موقّعة قصيرة الأجل للملفات المقيّدة (`?redirect=1`)، والسائق المحلي افتراضي. |
| 22 | Employee Attendance | ✅ | ساعة حضور بآلة حالة مُتحقَّقة + مدد محسوبة (Part S) + **حلقة تصحيح كاملة (§25)**: الموظف يطلب تصحيح سجله؛ المدير يعتمد/يرفض/يطلب تغييرات، والاعتماد يطبّق التغيير مع حفظ الأصل والتاريخ. بلا مراقبة تجسسية (مطابق). |
| 23 | Employee & Team Management | ✅ | ملفات الموظفين/الفرق + قائمة/تفاصيل بالعلامات/الدول المُسندة. *التعديل لاحقًا.* بلا gamification (مطابق). |
| 24 | Approval Center | ✅ | محرك موافقات متعدد الخطوات تسلسلي بتاريخ غير قابل للتعديل + قبول/رفض/طلب تغييرات/إلغاء (Part J) + "بانتظاري". |
| 25 | Subscriptions & Services | ✅ | مسار كتابة كامل (§23): إنشاء/تعديل/إسناد مالك/تجديد/إلغاء/أرشفة + **وظيفة تذكيرات تجديد idempotent** (90/60/30/14/7/1) مرئية في وظائف النظام (§24). لا تخزين كلمات مرور — مرجع طريقة دفع فقط (مطابق). |
| 26 | Full Accounting & Financial Analytics | ✅ | **Phase 3 — built & verified.** محرك قيد مزدوج متوازن + قيود مُرحَّلة غير قابلة للتعديل (عكس فقط) + فصل الشركات القانونية + عملات متعددة حتمية (Decimal). GL / Trial Balance / P&L / Balance Sheet + الذمم المدينة (فواتير/إشعارات/مقبوضات/أعمار الديون/كشف حساب) + الذمم الدائنة (فواتير موردين/إشعارات/مدفوعات + جسر المصروفات) + البنك/النقد/FX (تحويلات + تسوية + مركز نقدي) + الميزانيات (خطة مقابل فعلي) + التدفق النقدي + الذكاء المالي (P&L حسب البُعد + نظرة الشركة + تكامل 360). 63 مسار REST · 6 هجرات · 141 اختبار. راجع `ACCOUNTING_ARCHITECTURE.md` + `ACCOUNTING_POSTING_RULES.md` + `ACCOUNTING_SYSTEM_AUDIT.md`. |
| 27 | Management Analytics | 🟡 | نظرة تحليلية بمؤشرات حقيقية عبر الوحدات. *التحليلات القابلة للفلترة لكل مجال لاحقًا.* |
| 28 | Report Builder | 🧩 | `SavedView` + قائمة التقارير. *باني التقارير التفاعلي لاحقًا.* |
| 29 | Universal Search | ✅ | لوحة Cmd/K + `/api/v1/search` ضمن النطاق عبر عدة كيانات، **مع أوامر "إنشاء…" لكل وحدة** (§29) مُصفّاة بالصلاحية وترتبط عميقًا بواجهة الإنشاء (`?new=1` + `useCreateShortcut`) — بجانب أوامر التنقّل والبحث الحيّ. |
| 30 | Notification Center | ✅ | **الإشعارات 2.0 (§22)**: مقروء/غير مقروء/أرشفة/تحديد الكل، تجميع بمفتاح groupKey، فلترة بالفئة، روابط للكيان، و**تفضيلات لكل فئة** تُطبَّق في `notify()` فعلاً (تُسكِت الفئات المعطّلة). |
| 31 | Audit Log | ✅ | `AuditLog` + `writeAudit` + مستكشف تدقيق مقروء (لا JSON خام). *توسيع تغطية الإجراءات المدقّقة لاحقًا.* |
| 32 | Archive / Soft Delete | ✅ | `archivedAt` على الكيانات المهمة؛ القوائم تُرشّح `archivedAt:null`. |
| 33 | API-First Architecture | ✅ | خدمات النطاق مشتركة بين الويب و`/api/v1`، فحوص صلاحيات، مغلّف موحّد. |
| 34 | Web/Mobile Feature Parity | ✅ | `FeatureRegistry` + بوابة المطورين، و**مسح تكافؤ شامل (§30)**: كل مسار دورة حياة/تحرير كان متاحًا في الويب فقط أصبح له مكافئ تحت `/api/v1` عبر نفس خدمات الدومين — تغييرات الحالة (حملات/نشر/واتساب/تصميم)، إلغاء/أرشفة الاشتراكات، أرشفة المهمة وإسنادها وقوائمها، ملاحظات الحالات، تحرير مسودّات/مراجعات/تقاعد الأجوبة والمعرفة، تحديث التسجيلات ومتطلباتها وردود السلطة، قرار إصدار التصميم، مرفقات/مجلّدات الملفات، تحرير/حذف/تثبيت/تفاعل رسائل النقاش، وإتمام بنود الفحص اليومي. |
| 35 | Developer Portal | 🟡 | سجل الميزات + النقاط الطرفية + رموز API (بلا أسرار) + صحة النظام. *توليد التوثيق من المسارات لاحقًا.* |
| 36 | System Settings | 🟡 | `SystemSetting` + صفحة مجمّعة بالفئة (عرض فقط حتى الآن — P2). الوظائف والصلاحيات قابلة للكتابة (مركز العمليات + مصفوفة الصلاحيات). *واجهة كتابة الإعدادات العامة لاحقًا.* |
| 37 | Background Jobs & Monitoring | ✅ | **مُجدوِل داخل العملية حقيقي (تدقيق §10)** يبدأ من `instrumentation.ts` ويُطلق 6 وظائف idempotent بتقييم cron بلا اعتمادية؛ كل تشغيل يُسجَّل في `BackgroundJobRun` (حالة/مدة/خطأ/يدوي)، و**مركز العمليات** يعرضها مع تشغيل الآن/إعادة المحاولة بالصلاحية. |
| 38 | Security | ✅ | scrypt + جلسات HMAC + تفويض من الخادم + حماية IDOR + zod + عدم تسريب الأخطاء + تدقيق + **Rate limiting** (Phase 3 §1: ذاكرة/Upstash، دلاء لكل مسار، `finance_post` على كل تحويلات المحاسبة، خنق تسجيل الدخول والإجراءات). *MFA لاحقًا.* |
| 39 | Arabic + English | ✅ | قواميس en+ar، RTL/LTR، تواريخ/أرقام/عملات محلية، تم التحقق بلقطة RTL. *بعض النصوص الديناميكية ما زالت إنجليزية.* |
| 40 | Timezones & Currencies | 🟡 | مناطق زمنية للموظف/الشركة + تعدد عملات + تنسيق (KWD ٣ خانات). *عرض أسعار الصرف/المنطقة الزمنية بالكامل لاحقًا.* |
| 41 | Design Direction | ✅ | مستوى Linear/Attio؛ تجنّب كل الأنماط المرفوضة. |
| 42 | Design Language | ✅ | محايد دافئ/فحمي/بنفسجي، حدود رفيعة، ظلال خفيفة، فاتح+داكن. |
| 43 | Information Density | 🟡 | جداول كثيفة/فلاتر/بحث/رؤوس ثابتة/لوحات جانبية. *العروض المحفوظة/تخصيص الأعمدة/الإجراءات الجماعية/التحرير المضمّن لاحقًا.* |
| 44 | Entity Page Design | ✅ | صفحات 360 (Brand/Product/Campaign) بتبويبات وعلاقات ظاهرة. |
| 45 | Table Design | 🟡 | بحث/ترتيب/فلترة متعددة/ترقيم/رؤوس ثابتة/تنقّل الصفوف. *عروض محفوظة/إظهار-إخفاء أعمدة/تحجيم/تحديد جماعي/معاينة لاحقًا.* |
| 46 | Status Design | ✅ | نظام دلالي بخمس فئات، مقروء فاتح/داكن. |
| 47 | Timeline & Activity | ✅ | `ActivityTimeline` مقروء (من التدقيق) على المهام/الحالات/التسجيلات/الحملات/النشر/واتساب/التصميم/الاشتراكات/المعرفة/الأجوبة/الملفات/الموافقات/الفحوص اليومية، و**بعد مسح §28**: المتاجر وسير العمل والمستخدمين (تعيينات الأدوار). تحرير/حذف رسائل النقاش يكتب الآن أثرًا في التدقيق. |
| 48 | Favorites / Recent Items | 🧩 | `Favorite/RecentItem` مُنمذَجان. *الواجهة لاحقًا.* |
| 49 | Saved Views | 🧩 | `SavedView` مُنمذَج + حالة الفلاتر في الـURL. *واجهة الحفظ/المشاركة لاحقًا.* |
| 50 | Workflow Engine | ✅ | محرّك سير عمل **قابل للتهيئة ومُصدَّر** (§26–27): `WorkflowDefinition` + `WorkflowVersion` (تعريف تعريفي ثابت) + `WorkflowInstance` مربوطة بالإصدار الذي بدأت عليه (تعديل المسودّة أو تفعيل إصدار جديد لا يغيّر معنى السجلّات الجارية). مراحل/انتقالات/حالة ابتدائية/حالات نهائية/حقول ومستندات وموافقات مطلوبة/أدوار مسؤولة/مهل SLA/تصعيد/صلاحيات — كلها مُتحقَّق منها قبل التفعيل. تنفيذ الانتقالات مُقيَّد بالصلاحية ضمن نطاق السجلّ، مع سجلّ انتقالات، وإشعارات للأدوار، ووظيفة **تصعيد SLA** خاملة التكرار. **باني سير عمل مرئي احترافي** (`/workflows`) + لوحة `WorkflowPanel` داخل صفحة السجلّ. مُدقَّق حيًّا على Postgres (21 فحصًا) + اختبارات تحقّق. |
| 51 | Activity Ownership Principle | ✅ | مالك/حالة/موعد/نشاط على السجلات المهمة؛ شركة/علامة/دولة عند اللزوم. |
| 52 | File Versioning Principle | 🧩 | `FileVersion/DesignVersion` + سجل إصدارات التصميم. *واجهة إصدارات الملفات لاحقًا.* |
| 53 | No AI Dependency for V1 | ✅ | حتمي بالكامل، بلا اعتماد على الذكاء الاصطناعي. |
| 54 | Database Architecture | ✅ | تطبيع، معرّفات cuid ثابتة، حقول تدقيق، فهارس مركّبة (company/brand/country/status/owner/dates). |
| 55 | Technical Stack | ✅ | Greenfield → Next.js/React/TS/Tailwind/Prisma/Postgres-ready (مطابق للتوصية). |
| 56 | Architectural Modules | ✅ | حدود واضحة في `src/domain`، بلا Controller ضخم واحد. |
| 57 | API Standards | ✅ | ترقيم/فلترة/ترتيب/بحث/تحقق/أخطاء موحّدة/فحص صلاحيات/إصدار. **عمليات idempotent** حيث يلزم: upsert أداء المتجر لكل فترة، ومولّدات الفحوصات/النشر المتكرر لا تُكرِّر. |
| 58 | Responsive Web | 🟡 | سطح المكتب أولًا + تنقّل جانبي للجوال + شبكات متجاوبة. *تلميع الجوال العميق لاحقًا.* |
| 59 | Accessibility | 🟡 | تنقّل لوحة المفاتيح/تركيز مرئي/HTML دلالي/تسميات/حوارات وجداول معقولة. *تدقيق a11y كامل لاحقًا.* |
| 60 | Performance | ✅ | فهارس/ترقيم/فلترة من الخادم/`getLookups` يتجنّب N+1/لا تحميل كامل للبيانات. *التخزين المؤقت/الطوابير لاحقًا.* |
| 61 | Admin Data Management | 🟡 | **CRUD إداري كامل الآن للبيانات التنظيمية (تدقيق §6)**: شركات/علامات/أسواق/أقسام/فِرق/موظفون/مشاريع (خدمة+فعل+`/api/v1`+واجهة إنشاء على كل قائمة، تعديل/أرشفة على 360). *بعض البيانات المرجعية الأصغر (أنواع/سلطات) لا تزال ببذور — P2.* |
| 62 | Import / Export | ⬜ | لم يُبنَ بعد (صلاحيات التصدير مُنمذَجة كمفاتيح صلاحيات). |
| 63 | Comments & Mentions | 🧩 | `Comment/Reaction/Mention` مُنمذَجة. *واجهة التعليقات القابلة لإعادة الاستخدام لاحقًا.* |
| 64 | Dashboard Personalization | 🧩 | `Favorite/RecentItem/SavedView` + ثبات المظهر/اللغة. *واجهة التخصيص لاحقًا.* لا باني لوحات بالسحب (مطابق لـV1). |
| 65 | Empty States | ✅ | حالات فارغة مقصودة في كل مكان (ماذا/لماذا/الخطوة التالية). |
| 66 | Loading & Error Experience | ✅ | هياكل تحميل + حدود أخطاء + not-found + رفض صلاحية + بلا آثار خطأ خام. |
| 67 | Demo / Seed Data | ✅ | بيانات ثرية متعددة الشركات/العلامات (٣ شركات، ٤ علامات، ٦ أسواق، مستخدمون بنطاقات، منتجات/حملات/تسجيلات/شهادات/حالات/اشتراكات/حضور). |
| 68 | Testing | 🟡 | اختبارات الصلاحيات/النطاق/IDOR/كلمة المرور + **تفويض مسارات الكتابة** (إنشاء/تعديل/حالة/اعتماد + رفض IDOR عبر النطاق للحملات/المتاجر/النشر/واتساب/التصميم) — **47 ناجحة**، إضافةً إلى تحقّق حيّ على Postgres لكل مسار كتابة. *اختبارات المحاسبة/الملفات المقيّدة/النقاشات في الأطوار القادمة.* |
| 69 | Critical Security Test | ✅ | اختبار §69 صريح (وحدة + متحقّق على بيانات فعلية: موظف Brand A/KW مُنِع من فتح Brand B/سجل آخر بتغيير المعرّف). |
| 70 | Implementation Approach | ✅ | الأساس أولًا ثم توسّع مرحلي (Phase 1 + تغطية قراءة واسعة). |
| 71 | Build Real Features | ✅ | لا HTML ثابت/وهمي؛ بيانات حقيقية، جلسات تُحفظ، فلاتر/صلاحيات/حالات تعمل، **مسارات كتابة كاملة تُنشئ وتُعدّل وتُدقّق وتُشعِر وتُخزّن فعليًا** عبر الوحدات التشغيلية. |
| 72 | Migrations & Data Safety | ✅ | PostgreSQL لكل البيئات؛ ترحيلات مُصدَّرة في `prisma/migrations`، والنشر عبر `migrate deploy` (لا `db push`). التحقّق من هجرة قاعدة نظيفة + بذور. `docker-compose` للتطوير. |
| 73 | Existing Project Rule | ✅ | فُحص المستودع (كان فارغًا) → greenfield. |
| 74 | No Hidden Systems | ✅ | الوظائف/الرموز/التكاملات/الجداول/الصلاحيات/سير العمل/الحالة/الأخطاء/سجل الميزات مرئية إداريًا. |
| 75 | Admin Operations Center | ✅ | **أُعيد بناؤه (تدقيق §10)**: مُجدوِل حيّ + الوظائف مع الجدول/التالي/الأخير/المدة + سجل تشغيلات + تشغيل الآن/إعادة المحاولة + أحداث النظام — من سجل تشغيل حقيقي لا مرآة يدوية. |
| 76 | Design Acceptance Test | ✅ | متحقّق بلقطات: مظهر 2026، بمستوى Linear/Attio، كثافة واضحة، جداول ممتازة، عربي مقصود، داكن مُصمَّم لا مقلوب. |
| 77 | UX Details That Matter | 🟡 | لوحة أوامر + مفضلة/حديث (نماذج) + فلاتر في الـURL + حالة مستمرة. *معاينات hover/قوائم سياق/إنشاء سريع/أدراج جانبية/تحديث حالة مضمّن لاحقًا.* |
| 78 | Don't Overuse Modals | ✅ | لوحات/صفحات مخصّصة؛ النوافذ المنبثقة قليلة. |
| 79 | Form Design | ✅ | أساس `ActionForm` (تحقّق لكل حقل + حارس حالة متّسخة + toasts + حالات تحميل/خطأ/صلاحية) في **أدراج** لا نوافذ عملاقة، مستخدَم عبر كل مسارات الكتابة. *حفظ تلقائي/مسودّة أعمق لاحقًا.* |
| 80 | Final Product Goal | 🟡 | "الذاكرة التشغيلية": الإدارة تُجيب قراءةً عبر مركز القيادة/صفحات 360، **والفِرَق تُشغّل العمل فعليًا كتابةً** (مهام/فحوصات/موافقات/حالات/تسجيلات/حملات/نشر/تصميم). *يكتمل حين تحلّ طبقة التعاون/الملفات محلّ مجموعات واتساب والمجلدات المشتركة (الطور 2.5).* |
| 81 | Your First Action | ✅ | فُحص المستودع، رُسِمت البنية، عُرِّف النطاق/الصلاحيات/الـAPI/التصميم/التنقل/المراحل، ثم التنفيذ بحُكم هندسي قوي — بلا قالب ERP عام. |

---

## أبرز الفجوات والمراحل التالية (Key gaps → next phases)

أُنجزت في المرحلة 2 **كل مسارات الكتابة التشغيلية** + إدارة الصلاحيات من الواجهة + PostgreSQL/الترحيلات + CI. البنود المتبقّية، مرتّبة حسب القيمة:

1. **طبقة التعاون/المعرفة/الملفات (الطور 2.5 الجاري):** منصّة الملفات الحقيقية + الإصدارات + المرفقات عبر الكيانات (§21/§52)؛ النقاشات الداخلية + التحويل إلى عمل (§20)؛ مكتبة الأجوبة المعتمدة (§18) وقاعدة المعرفة (§19) بالإصدارات؛ يومي 2.0 (§6)؛ الإشعارات 2.0 (§30)؛ الاشتراكات + التذكيرات (§25)؛ حلقة تصحيح الحضور (§22)؛ باني سير العمل (§50).
2. **المحاسبة الكاملة (§26):** ترحيل القيود + التقارير المالية — الطور المخصّص الذي يلي 2.5 (البنية والأبعاد جاهزة، والدلالات المالية مُحكَمة).
3. **مُشغّل مُجدوَل (cron)** لتذكيرات الشهادات/الاشتراكات وتسليم الإشعارات (المولّدات نفسها حقيقية وidempotent).
4. **إدارة البيانات المرجعية من الواجهة (§61)** + **باني التقارير (§28)** + **العروض المحفوظة/المفضلة (§48/§49)**.
5. **الاستيراد/التصدير (§62)** و**تقوية الأمان (§38):** Rate limiting، MFA، والتحقق من رفع الملفات (يُنفَّذ ضمن أمان الملفات في الطور 2.5).

> تمتد كل هذه المراحل على **نفس الأساس** (المخطط + محرك الصلاحيات + طبقة الخدمات + الـAPI + نظام التصميم) دون إعادة تصميم — وهو بالضبط ما نصّ عليه القسمان 70 و81.

---

## التحقّق (Verification snapshot — بعد المرحلة 2)
- `npm run typecheck` → **0 أخطاء** · `npm run build` → نجاح
- `npm run test` → **47/47 ناجحة** (صلاحيات/نطاق/IDOR + تفويض مسارات الكتابة، تشمل §69) · `npm run db:seed` → ينجح · `prisma migrate status` → محدَّث
- **تحقّق حيّ على PostgreSQL** لكل مسار كتابة (١٢ سكربت): الإنشاء ضمن النطاق يُخزَّن ويُدقَّق، وخارج النطاق يُمنَع؛ حرّاس الانتقالات/نقاط التحقّق؛ idempotency؛ ذرّية المعاملات؛ حصرية اعتماد الإصدار.
- التفويض مُطبَّق على مستوى الـAPI والصفحة؛ والنطاق مُتحقَّق منه على بيانات فعلية.
