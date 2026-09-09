# NEXORA OS — تقرير المطابقة مع ملف المتطلبات
### Spec Coverage Report — Master Build Script vs. What Was Built

> تقرير صادق يقارن كل قسم من الأقسام الـ81 في *Master Build Script* بما تم تنفيذه فعليًا في هذه الجلسة.
> A candid, section-by-section comparison of the 81-section brief against the delivered code.
>
> **الفرع / Branch:** `claude/new-session-9incr7` · **تاريخ / Date:** 2026-09-09

---

## ملخص تنفيذي (Executive summary)

بُنِيت **الأساس الكامل (Phase 1)** الذي يطلبه الملف صراحةً في القسمين 70 و81 — "ابنِ المنصة المشتركة أولًا بشكل صحيح" — إضافةً إلى **تغطية عرضية واسعة لكل الوحدات التشغيلية** (قوائم + صفحات تفصيل + خدمات + واجهة REST). كل شاشة موصولة ببيانات حقيقية، والصلاحيات مُطبَّقة من جهة الخادم، واختبار الأمان الحرج (§69) يعمل ومُتحقَّق منه على بيانات فعلية.

**ما هو مكتمل بقوة:** النموذج العلائقي الكامل، محرك الصلاحيات RBAC + النطاقات (Company/Brand/Country/Department/Team)، مصفوفة الصلاحيات + مُختبِر الصلاحيات، البنية API-first، نظام التصميم (فاتح/داكن + عربي RTL)، مركز القيادة، يومي، وحدة المؤسسة (شركات/علامات/أسواق/فرق/موظفون)، والتدقيق.

**ما هو جزئي بطبيعته:** معظم الوحدات مبنيّة حاليًا كـ **قراءة/قوائم/تفاصيل** فعلية على بيانات حقيقية؛ أما **مسارات الكتابة العميقة** (تنفيذ الموافقات، ترحيل القيود المحاسبية، رفع الملفات إلى تخزين كائني، إتمام الفحوصات اليومية بالأدلة، الدردشة الحيّة) فهي **ممثَّلة في المخطط وجاهزة عبر الـ API** لكن واجهاتها التفاعلية هي المراحل التالية (Phases 2–8) التي تمتد على نفس الأساس دون إعادة تصميم.

### مفتاح الحالات (Legend)
| الرمز | المعنى |
|------|--------|
| ✅ | **مكتمل** — منفّذ ويعمل (واجهة + خدمة + نطاق + بيانات حقيقية) |
| 🟡 | **جزئي** — القراءة/القائمة/التفاصيل جاهزة؛ مسارات الكتابة/الميزات المتقدمة لاحقًا |
| 🧩 | **البنية + الـAPI جاهزة** — مُنمذَج في المخطط والخدمات؛ واجهة مخصصة لاحقًا |
| ⬜ | **لم يبدأ بعد** |

### إحصاء تقريبي (Approximate tally)
- ✅ مكتمل: **~30 قسمًا** (الأساس، الصلاحيات، التصميم، التنقل، مركز القيادة، الأمان الأساسي، التدقيق، الأرشفة، API-first، اللغتان، بيانات العرض، اختبار §69، …)
- 🟡 جزئي: **~35 قسمًا** (معظم الوحدات التشغيلية — قراءة/تفاصيل جاهزة، الكتابة لاحقًا)
- 🧩 بنية جاهزة: **~13 قسمًا** (المحاسبة، محرك سير العمل، النقاشات، الملفات، التقارير، المفضلة/العروض المحفوظة، التعليقات، …)
- ⬜ لم يبدأ: **~3 أقسام** (الاستيراد/التصدير، وبعض عناصر التخصيص المتقدمة)

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
| U | API parity | ✅* | Each implemented action is exposed under `/api/v1` sharing the exact domain logic. |
| V | Transactions & concurrency | ✅ | Multi-record ops (task+assignees+checklist, approval decisions, registration stage+event, break accounting, role+permissions) run in `prisma.$transaction`; generator + dependencies are idempotent/guarded. |
| K | Marketing Campaign write path | 🟡 | **Next increment.** Read/detail exist; create/edit/status/metrics follow the same proven pattern. |
| L,M | Social publishing actions + recurring | 🟡 | **Next increment.** |
| N | WhatsApp workflow | 🟡 | **Next increment.** |
| O | Creative request actions | 🟡 | **Next increment.** |
| P | Store performance entry | 🟡 | **Next increment.** |
| W | UX quality | ✅ | Drawers, inline controls, toasts, dirty-guard, activity timelines, validation — premium; RTL + dark verified across the foundation. |
| Y | Accounting UI deferred | ✅ | Schema + dimensions preserved; no accounting UI built this phase (as instructed). |
| Z | Verification + tests + coverage | ✅ | typecheck + build + 31 tests (incl. mutation-authorization suite) + clean-DB migration + seed; each write path verified live on Postgres. This document updated. |

**Changelog (this phase):** branches (A) → security hardening (B) → PostgreSQL + migrations (C) → CI (D) → action/form foundation (F) → Tasks (G) → Daily Checks + generator (H,I) → Approvals (J) → Attendance (S) → Customer Cases (Q) → Regulatory (R) → Permission administration (X) → verification (Z). Each shipped as its own commit with an end-to-end Postgres verification.

**Remaining gaps (next increment), in priority order:** Campaign write path + manual metrics (K); Store performance entry (P); Social publishing actions + coverage matrix + recurring generator (L, M); WhatsApp workflow (N); Creative request lifecycle + version approval (O). Then: employee-initiated attendance-correction approval loop; file uploads to object storage (§21/§52); the configurable Workflow engine UI (§50); the full accounting posting + statements (§26, the dedicated next phase per Part Y); rate-limiting + MFA (§38).

---

## المقارنة التفصيلية (Section-by-section)

| # | Section (from brief) | Status | ملاحظات / Notes |
|---|----------------------|:------:|------------------|
| 1 | Do not build disconnected modules | ✅ | مخطط علائقي بالكامل؛ chips علائقية، صفحات 360، `getLookups`/`refName`. |
| 2 | Organizational hierarchy | ✅ | Company/Brand/Country/Department/Team/Employee؛ علامة قد تتبع أكثر من شركة عبر `BrandCompany`. لا حدود صلبة. |
| 3 | Permissions (RBAC + scope) — **critical** | ✅ | محرك خالص مختبَر (`can`/`scopeWhereFor`/`assertRecordInScope`)، تطبيق على API+خادم، مصفوفة + مُختبِر صلاحيات. *ملاحظة: تحرير الأدوار/الإسنادات من الواجهة (وتدقيق تغييرها) لاحقًا — حاليًا مُبذّرة بالـseed.* |
| 4 | Global navigation | ✅ | كامل التنقل §4، يتكيّف مع الصلاحيات. |
| 5 | Command Center | ✅ | Needs Attention / Live Ops / Pulse ببيانات حقيقية ضمن النطاق. *الفلترة بالشركة/العلامة/الدولة/التاريخ داخل الصفحة لاحقًا.* |
| 6 | My Day | 🟡 | مهام + فحوصات + موافقات + مواعيد + حضور. *الإشارات (mentions) والحالات/طلبات التصميم المُسندة لاحقًا.* |
| 7 | Universal Task Engine | 🟡 | نموذج المهام كامل (تبعيات/مهام فرعية/تكرار/تصعيد في المخطط) + قائمة/تفاصيل/قائمة تحقق. *نماذج الإنشاء/التعديل ومحرّك التكرار لاحقًا.* الحالات قابلة للتهيئة عبر `StatusDefinition`. |
| 8 | Daily Check System | 🟡 | قوالب/عناصر/إسنادات/نُسخ اليوم + لوحة الامتثال. *إتمام الفحص بالأدلة/موافقة المشرف + مولّد التكرار (وظيفة مرئية) لاحقًا.* |
| 9 | Marketing Campaigns | 🟡 | نموذج الحملة كامل + قائمة + 360 + مقاييس/تقارير (عرض)، إدخال أداء يدوي. *نماذج الإدخال/التقرير لاحقًا.* البنية تسمح بإضافة تكاملات API لاحقًا. |
| 10 | Social Publishing Control | 🟡 | `SocialAccount` + `PublishingItem` بنقاط تحقّق "مُجدول/منشور" + قائمة. *تقويم النشر + مصفوفة التغطية + التوليد المتكرر لاحقًا.* ليست ناشرًا عبر API (مطابق). |
| 11 | WhatsApp Campaigns | 🟡 | نموذج + قائمة. *سير العمل الداخلي الكامل + ربط طلب التصميم لاحقًا.* لا إرسال عبر API (مطابق). |
| 12 | Creative / Design | 🟡 | `DesignRequest` + إصدارات + قائمة/تفاصيل + سجل الإصدارات ومبدأ "عدم استبدال المعتمد". *إجراءات الرفع/المراجعة لاحقًا.* |
| 13 | Products (Master + 360) | ✅ | Product Master + صفحة 360 بتبويبات (Overview/Markets/Regulatory/Documents/Campaigns/Support). *الإنشاء/التعديل لاحقًا.* |
| 14 | Global Regulatory Registration | 🟡 | `RegistrationCase` + خط زمني للأحداث + مستندات مطلوبة + سلطات/أنواع + قائمة/تفاصيل. *محرّك قوالب سير العمل القابل للتهيئة من الواجهة + انتقالات المراحل لاحقًا.* |
| 15 | Certificate & Document Expiration | 🟡 | `Document` + حالات + تتبّع انتهاء + عرض المستندات/الشهادات + إبراز المنتهية/الموشكة في مركز القيادة. *عتبات التنبيه القابلة للتهيئة (وظيفة مرئية) لاحقًا.* |
| 16 | E-commerce Stores | 🟡 | `Store` + أداء + قائمة/تفاصيل + نظرة مبيعات. إدخال يدوي (مطابق). *واجهة إدخال الأداء لاحقًا.* |
| 17 | Customer Service | 🟡 | `CustomerCase` + ملاحظات + قائمة/تفاصيل. *إجراءات/سير عمل الحالة لاحقًا.* |
| 18 | Approved Answer Library | 🟡 | `ApprovedAnswer` + `AnswerRequest` + قائمة + إصدار/حالة. *بحث/نسخ/طلب جواب جديد + مسار الاعتماد لاحقًا.* |
| 19 | Internal Knowledge Base | 🟡 | `KnowledgeArticle` + قائمة. *عرض/تحرير/إصدارات المقالة لاحقًا.* |
| 20 | Internal Discussions | 🧩 | `Channel/Message/Member/Mention` + قائمة القنوات. *الدردشة والتحويل إلى مهمة/حالة/موافقة + التفاعلات/التثبيت لاحقًا.* |
| 21 | File Management | 🧩 | `File/FileVersion/Folder` + قائمة تحترم الملفات المقيّدة. *الرفع/الإصدارات/المعاينة + تخزين كائني لاحقًا.* |
| 22 | Employee Attendance | 🟡 | `AttendanceRecord/Event/Leave/Holiday` + لوحة حضور اليوم. *أزرار الحضور/الانصراف + التصحيحات/الجداول لاحقًا.* بلا مراقبة تجسسية (مطابق). |
| 23 | Employee & Team Management | ✅ | ملفات الموظفين/الفرق + قائمة/تفاصيل بالعلامات/الدول المُسندة. *التعديل لاحقًا.* بلا gamification (مطابق). |
| 24 | Approval Center | 🟡 | `ApprovalRequest/Step` + قائمة + "بانتظاري" + سلسلة الموافقة. *أزرار الموافقة/الرفض + محرك التوجيه متعدد الخطوات لاحقًا.* |
| 25 | Subscriptions & Services | 🟡 | `Subscription` + قائمة + تنبيهات التجديد. *الإنشاء/التعديل + إدارة الأسرار لاحقًا.* لا تخزين كلمات مرور (مطابق). |
| 26 | Full Accounting & Financial Analytics | 🧩 | كل الكيانات مُنمذَجة: FiscalYear/Period/Account/Journal(+dimensions)/CostCenter/Customer/Supplier/Invoice/Payment/Bank/Budget/Expense/ExchangeRate/TaxRate + نظرة مالية + مصروفات. *الترحيل + التقارير (Trial Balance/P&L/Balance Sheet/…) لاحقًا.* الأبعاد التحليلية جاهزة في المخطط. |
| 27 | Management Analytics | 🟡 | نظرة تحليلية بمؤشرات حقيقية عبر الوحدات. *التحليلات القابلة للفلترة لكل مجال لاحقًا.* |
| 28 | Report Builder | 🧩 | `SavedView` + قائمة التقارير. *باني التقارير التفاعلي لاحقًا.* |
| 29 | Universal Search | ✅ | لوحة Cmd/K + `/api/v1/search` ضمن النطاق عبر عدة كيانات. *أوامر "إنشاء…" لاحقًا (أوامر التنقل جاهزة).* |
| 30 | Notification Center | 🟡 | `Notification/Preference` + صفحة + عدّاد غير مقروء بالشريط. *التفضيلات + الدمج/الملخّص لاحقًا.* |
| 31 | Audit Log | ✅ | `AuditLog` + `writeAudit` + مستكشف تدقيق مقروء (لا JSON خام). *توسيع تغطية الإجراءات المدقّقة لاحقًا.* |
| 32 | Archive / Soft Delete | ✅ | `archivedAt` على الكيانات المهمة؛ القوائم تُرشّح `archivedAt:null`. |
| 33 | API-First Architecture | ✅ | خدمات النطاق مشتركة بين الويب و`/api/v1`، فحوص صلاحيات، مغلّف موحّد. |
| 34 | Web/Mobile Feature Parity | 🟡 | `FeatureRegistry` + بوابة المطورين تُظهر توفّر الويب/الموبايل. *استكمال السجل لكل الميزات لاحقًا.* |
| 35 | Developer Portal | 🟡 | سجل الميزات + النقاط الطرفية + رموز API (بلا أسرار) + صحة النظام. *توليد التوثيق من المسارات لاحقًا.* |
| 36 | System Settings | 🟡 | `SystemSetting` + صفحة إعدادات مجمّعة بالفئة (عرض). *واجهة إدارة البيانات المرجعية لاحقًا.* |
| 37 | Background Jobs & Monitoring | 🟡 | `BackgroundJob/SystemEvent` + صفحة صحة النظام (وظائف/جداول/حالة). *مُشغّل الوظائف الفعلي لاحقًا — الوظائف مرئية كـstubs.* |
| 38 | Security | 🟡 | scrypt + جلسات HMAC + تفويض من الخادم + حماية IDOR + zod + عدم تسريب الأخطاء + تدقيق. *Rate limiting / MFA / التحقق من رفع الملفات لاحقًا (البنية مهيّأة).* |
| 39 | Arabic + English | ✅ | قواميس en+ar، RTL/LTR، تواريخ/أرقام/عملات محلية، تم التحقق بلقطة RTL. *بعض النصوص الديناميكية ما زالت إنجليزية.* |
| 40 | Timezones & Currencies | 🟡 | مناطق زمنية للموظف/الشركة + تعدد عملات + تنسيق (KWD ٣ خانات). *عرض أسعار الصرف/المنطقة الزمنية بالكامل لاحقًا.* |
| 41 | Design Direction | ✅ | مستوى Linear/Attio؛ تجنّب كل الأنماط المرفوضة. |
| 42 | Design Language | ✅ | محايد دافئ/فحمي/بنفسجي، حدود رفيعة، ظلال خفيفة، فاتح+داكن. |
| 43 | Information Density | 🟡 | جداول كثيفة/فلاتر/بحث/رؤوس ثابتة/لوحات جانبية. *العروض المحفوظة/تخصيص الأعمدة/الإجراءات الجماعية/التحرير المضمّن لاحقًا.* |
| 44 | Entity Page Design | ✅ | صفحات 360 (Brand/Product/Campaign) بتبويبات وعلاقات ظاهرة. |
| 45 | Table Design | 🟡 | بحث/ترتيب/فلترة متعددة/ترقيم/رؤوس ثابتة/تنقّل الصفوف. *عروض محفوظة/إظهار-إخفاء أعمدة/تحجيم/تحديد جماعي/معاينة لاحقًا.* |
| 46 | Status Design | ✅ | نظام دلالي بخمس فئات، مقروء فاتح/داكن. |
| 47 | Timeline & Activity | 🟡 | خط زمني للتسجيلات جاهز + مستكشف تدقيق مقروء. *خطوط زمنية عامة لكل كيان لاحقًا.* |
| 48 | Favorites / Recent Items | 🧩 | `Favorite/RecentItem` مُنمذَجان. *الواجهة لاحقًا.* |
| 49 | Saved Views | 🧩 | `SavedView` مُنمذَج + حالة الفلاتر في الـURL. *واجهة الحفظ/المشاركة لاحقًا.* |
| 50 | Workflow Engine | 🧩 | `WorkflowTemplate` + حالات نصية قابلة للتهيئة. *المحرّك القابل للتهيئة + واجهته لاحقًا.* |
| 51 | Activity Ownership Principle | ✅ | مالك/حالة/موعد/نشاط على السجلات المهمة؛ شركة/علامة/دولة عند اللزوم. |
| 52 | File Versioning Principle | 🧩 | `FileVersion/DesignVersion` + سجل إصدارات التصميم. *واجهة إصدارات الملفات لاحقًا.* |
| 53 | No AI Dependency for V1 | ✅ | حتمي بالكامل، بلا اعتماد على الذكاء الاصطناعي. |
| 54 | Database Architecture | ✅ | تطبيع، معرّفات cuid ثابتة، حقول تدقيق، فهارس مركّبة (company/brand/country/status/owner/dates). |
| 55 | Technical Stack | ✅ | Greenfield → Next.js/React/TS/Tailwind/Prisma/Postgres-ready (مطابق للتوصية). |
| 56 | Architectural Modules | ✅ | حدود واضحة في `src/domain`، بلا Controller ضخم واحد. |
| 57 | API Standards | ✅ | ترقيم/فلترة/ترتيب/بحث/تحقق/أخطاء موحّدة/فحص صلاحيات/إصدار. *Idempotency لعمليات الكتابة لاحقًا.* |
| 58 | Responsive Web | 🟡 | سطح المكتب أولًا + تنقّل جانبي للجوال + شبكات متجاوبة. *تلميع الجوال العميق لاحقًا.* |
| 59 | Accessibility | 🟡 | تنقّل لوحة المفاتيح/تركيز مرئي/HTML دلالي/تسميات/حوارات وجداول معقولة. *تدقيق a11y كامل لاحقًا.* |
| 60 | Performance | ✅ | فهارس/ترقيم/فلترة من الخادم/`getLookups` يتجنّب N+1/لا تحميل كامل للبيانات. *التخزين المؤقت/الطوابير لاحقًا.* |
| 61 | Admin Data Management | 🧩 | البيانات المرجعية مُنمذَجة (دول/عملات/منصّات/أنواع/سلطات/حالات/قوالب/أقسام/فئات). *واجهات CRUD الإدارية لاحقًا؛ صفحة الإعدادات تعرض جزءًا.* |
| 62 | Import / Export | ⬜ | لم يُبنَ بعد (صلاحيات التصدير مُنمذَجة كمفاتيح صلاحيات). |
| 63 | Comments & Mentions | 🧩 | `Comment/Reaction/Mention` مُنمذَجة. *واجهة التعليقات القابلة لإعادة الاستخدام لاحقًا.* |
| 64 | Dashboard Personalization | 🧩 | `Favorite/RecentItem/SavedView` + ثبات المظهر/اللغة. *واجهة التخصيص لاحقًا.* لا باني لوحات بالسحب (مطابق لـV1). |
| 65 | Empty States | ✅ | حالات فارغة مقصودة في كل مكان (ماذا/لماذا/الخطوة التالية). |
| 66 | Loading & Error Experience | ✅ | هياكل تحميل + حدود أخطاء + not-found + رفض صلاحية + بلا آثار خطأ خام. |
| 67 | Demo / Seed Data | ✅ | بيانات ثرية متعددة الشركات/العلامات (٣ شركات، ٤ علامات، ٦ أسواق، مستخدمون بنطاقات، منتجات/حملات/تسجيلات/شهادات/حالات/اشتراكات/حضور). |
| 68 | Testing | 🟡 | اختبارات الصلاحيات/النطاق/IDOR/كلمة المرور (21 ناجحة). *اختبارات المحاسبة/الموافقات/التكرار/الحضور/الانتهاء لاحقًا.* |
| 69 | Critical Security Test | ✅ | اختبار §69 صريح (وحدة + متحقّق على بيانات فعلية: موظف Brand A/KW مُنِع من فتح Brand B/سجل آخر بتغيير المعرّف). |
| 70 | Implementation Approach | ✅ | الأساس أولًا ثم توسّع مرحلي (Phase 1 + تغطية قراءة واسعة). |
| 71 | Build Real Features | ✅ | لا HTML ثابت/وهمي؛ بيانات حقيقية، جلسات تُحفظ، فلاتر تعمل، صلاحيات تعمل، حالات تُعرض، تاريخ يُسجَّل. *نماذج الإنشاء/التعديل هي المرحلة التالية.* |
| 72 | Migrations & Data Safety | 🟡 | Prisma migrations متاحة (`db:migrate`)؛ التطوير يستخدم `db push` حاليًا؛ إضافي وآمن. |
| 73 | Existing Project Rule | ✅ | فُحص المستودع (كان فارغًا) → greenfield. |
| 74 | No Hidden Systems | ✅ | الوظائف/الرموز/التكاملات/الجداول/الصلاحيات/سير العمل/الحالة/الأخطاء/سجل الميزات مرئية إداريًا. |
| 75 | Admin Operations Center | 🟡 | صحة النظام + بوابة المطورين تغطّي معظم العناصر. *بعضها stubs.* |
| 76 | Design Acceptance Test | ✅ | متحقّق بلقطات: مظهر 2026، بمستوى Linear/Attio، كثافة واضحة، جداول ممتازة، عربي مقصود، داكن مُصمَّم لا مقلوب. |
| 77 | UX Details That Matter | 🟡 | لوحة أوامر + مفضلة/حديث (نماذج) + فلاتر في الـURL + حالة مستمرة. *معاينات hover/قوائم سياق/إنشاء سريع/أدراج جانبية/تحديث حالة مضمّن لاحقًا.* |
| 78 | Don't Overuse Modals | ✅ | لوحات/صفحات مخصّصة؛ النوافذ المنبثقة قليلة. |
| 79 | Form Design | 🧩 | نموذج الدخول جيّد. *نماذج الكيانات الطويلة بأقسام/حفظ تلقائي/مسودّة لاحقًا (قليل من نماذج الكتابة حتى الآن).* |
| 80 | Final Product Goal | 🟡 | "الذاكرة التشغيلية": معظم أسئلة الإدارة قابلة للإجابة قراءةً عبر مركز القيادة/صفحات 360/التحليلات؛ بعضها يحتاج مسارات الكتابة القادمة. |
| 81 | Your First Action | ✅ | فُحص المستودع، رُسِمت البنية، عُرِّف النطاق/الصلاحيات/الـAPI/التصميم/التنقل/المراحل، ثم التنفيذ بحُكم هندسي قوي — بلا قالب ERP عام. |

---

## أبرز الفجوات والمراحل التالية (Key gaps → next phases)

هذه هي البنود التي تحتاج عملًا لتصبح "مكتملة"، مرتّبة حسب القيمة:

1. **مسارات الكتابة/الإجراءات (أعلى قيمة):** إنشاء/تعديل عبر الوحدات — إجراءات الموافقة (قبول/رفض/تصعيد)، إتمام الفحص اليومي بالأدلة، إدخال أداء الحملات/المتاجر، تحرير حالات العملاء والتسجيلات، ونماذج الكيانات (أقسام + حفظ تلقائي + مسودّة — §79).
2. **المحاسبة الكاملة (§26):** ترحيل القيود + التقارير المالية (ميزان المراجعة/الأرباح والخسائر/الميزانية/التدفق النقدي/أعمار الذمم) — البنية والأبعاد جاهزة.
3. **مشغّل الوظائف الخلفية (§8/§15/§37):** توليد الفحوصات المتكررة، تذكيرات انتهاء الشهادات/الاشتراكات، تسليم الإشعارات — الوظائف مرئية كـstubs الآن.
4. **النقاشات الحيّة (§20) + الملفات/الإصدارات (§21/§52):** الدردشة والتحويل إلى مهمة/حالة، ورفع الملفات إلى تخزين كائني مع الإصدارات والمعاينة.
5. **محرّك سير العمل القابل للتهيئة (§50)** + **إدارة البيانات المرجعية من الواجهة (§61)** + **باني التقارير (§28)** + **العروض المحفوظة/المفضلة (§48/§49)**.
6. **الاستيراد/التصدير (§62)** و**تقوية الأمان (§38):** Rate limiting، MFA، التحقق من رفع الملفات.
7. **تحرير الأدوار/الإسنادات من الواجهة (§3)** مع تدقيق كل تغيير، و**توسيع تغطية التدقيق** لكل إجراء حسّاس.

> تمتد كل هذه المراحل على **نفس الأساس** (المخطط + محرك الصلاحيات + طبقة الخدمات + الـAPI + نظام التصميم) دون إعادة تصميم — وهو بالضبط ما نصّ عليه القسمان 70 و81.

---

## التحقّق (Verification snapshot)
- `npm run typecheck` → **0 أخطاء** · `npm run build` → نجاح (~60 مسارًا)
- `npm run test` → **21/21 ناجحة** (تشمل §69) · `npm run db:seed` → ينجح
- تحقّق وقت التشغيل: التفويض مُطبَّق على مستوى الـAPI والصفحة؛ والنطاق مُتحقَّق منه على بيانات فعلية.
