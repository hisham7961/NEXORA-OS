# NEXORA — Operational Metric Dictionary

Single source of truth for how operational financial metrics are defined and
computed. Accounting, Analytics and any future reporting **must** use these
definitions so numbers reconcile across the platform. The rule everywhere is the
same: **store the input components as entered; derive calculated values
server-side** in the domain service — never in a React component, never twice.

A missing (null) input is treated as **0** in the arithmetic. A derived value is
`null` only when it has no meaningful basis (e.g. no gross sales entered, or a
division by zero orders).

---

## 1. Campaign spend & budget (`Campaign`, `CampaignMetric`)

| Metric | Kind | Definition |
|---|---|---|
| **Planned budget** (`Campaign.plannedBudget`) | Input (user-managed) | The intended budget. Editable on the campaign form. Never derived. |
| **Actual spend** (`Campaign.actualSpend`) | **Derived** | `Σ CampaignMetric.value` where `name = "spend"` and `isTarget = false`. |
| **Budget used %** | Derived (display) | `actualSpend / plannedBudget × 100`. |
| **Remaining / over budget** | Derived (display) | `plannedBudget − actualSpend`. |

**Authoritative source & invariants**
- `actualSpend` has exactly **one writer**: `recomputeCampaignSpend()` in
  `src/domain/campaigns.ts`. It is **not** independently editable — the campaign
  create/edit form and API do **not** accept `actualSpend`.
- It is recomputed atomically (inside the same `$transaction`) on **add** and
  **delete** of a metric (`addCampaignMetric`, `deleteCampaignMetric`). Any future
  metric edit must call `recomputeCampaignSpend()` in the same transaction.
- A `spend` metric with `isTarget = true` is a **target**, excluded from actual spend.

**Migration / compatibility** — `backfillCampaignSpend()` (job route
`POST /api/v1/jobs/campaign-spend-backfill/run`, `campaigns.manage`) is
idempotent:
1. If a campaign has non-target `spend` metrics → recompute `actualSpend` from them.
2. Else if it carries a legacy directly-entered `actualSpend > 0` → materialize
   that figure as a single dated `spend` metric noted *"Migrated legacy
   actualSpend"*, then recompute. The historical value is preserved and the
   derived model becomes the single source of truth.

---

## 2. Store performance (`StorePerformance`)

### Inputs (entered, stored as-is)
| Field | Meaning |
|---|---|
| `sales` | **Gross Sales** — top-line before discounts and refunds. |
| `orders` | Number of orders in the period. |
| `unitsSold` | Units sold. |
| `returns` | Number of returned units/orders (count). |
| `discounts` | Total discounts applied (money). |
| `refunds` | Total refunded (money). |
| `cogs` | Cost of Goods Sold (money). |
| `adSpend` | Advertising spend (money). |
| `shippingCost` | Shipping / fulfilment cost (money). |
| `conversionRate` | Optional entered conversion rate. |

### Derived (computed server-side in `deriveStoreMetrics()`)
| Field | Formula |
|---|---|
| **Net Sales** (`netSales`) | `Gross Sales − Discounts − Refunds` |
| **AOV** (`aov`) | `Net Sales ÷ Orders` (null if orders = 0) |
| **Gross Profit** (`grossMargin`) | `Net Sales − COGS` |
| **Net Contribution** (`netContribution`) | `Gross Profit − Ad Spend − Shipping Cost` |

Notes:
- The column is named `grossMargin` for backward compatibility but its value is
  **Gross Profit** as defined above.
- `discounts` is now a first-class part of the model (previously it was stored but
  ignored — fixed in Phase 2.5).
- Derivation lives in `deriveStoreMetrics()` (`src/domain/stores.ts`) and is the
  only place these are computed. Re-recording a `(store, periodType, periodStart)`
  upserts and re-derives, so entry and imports are idempotent.

### Worked example
Gross Sales 1000, Discounts 50, Refunds 30, COGS 400, Ad Spend 100, Shipping 20,
Orders 40 →
Net Sales `1000 − 50 − 30 = 920` · AOV `920/40 = 23` · Gross Profit
`920 − 400 = 520` · Net Contribution `520 − 100 − 20 = 400`.

---

_When Accounting is built, it consumes these same definitions; it must not
recompute operational metrics with different formulas._
