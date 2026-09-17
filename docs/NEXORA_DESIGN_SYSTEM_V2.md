# NEXORA Design System v2 — Direction

**Audit branch:** `claude/nexora-360-audit` · **Date:** 2026-09-17

Not a repaint. NEXORA's visual foundation is sound; v2 is about **closing the premium gap** through a
few systemic moves, then routing pages through shared primitives. Preserve the warm-neutral / graphite /
muted-plum identity and the RTL discipline.

## Principles

1. **Density with air.** Professional operators handle many records; favour sophisticated density
   (Linear/Attio) over giant whitespace — but keep consistent breathing room via one spacing scale.
2. **One primitive per job.** Every page composes shared primitives; no page reinvents a header, table,
   or drawer. Consistency is the premium signal.
3. **Semantic colour only.** Colour carries meaning (the 5 status categories), never decoration. No
   rainbow dashboards, neon, heavy gradients, or glassmorphism.
4. **Typographic hierarchy.** Clear weight/size steps between page / section / record / metadata /
   action — not everything at the same weight.
5. **Both languages first-class.** Arabic is designed, not mirrored: correct line-height, numeric
   blocks LTR inside RTL, mirrored directional icons.
6. **Accessible by construction.** AA contrast in both themes; every control labelled and focus-managed.

## Systemic moves (do these first — they lift every screen)

1. **Load the type.** Inter (Latin) + an Arabic face via `next/font`, wired to `--font-sans` and the
   RTL face. (Fixes UX-01.)
2. **Fix the contrast tokens.** Darken `--ink-3` to ≥4.5:1 on surface; raise on-soft badge-text tokens.
   Add a tiny build-time contrast check to `globals.css` token pairs. (Fixes UX-02/03.)
3. **Repair the form primitive.** `FormField` associates label↔control via `useId()`; required/optional
   and error states standardised. (Fixes UX-13; lifts every form.)
4. **Focus + motion.** Add focus-trap/restore to `Drawer` and `CommandPalette`; replace the dead
   `slide-up` with the RTL-aware inline-end transition. (Fixes UX-14/17.)
5. **Mirror directional icons** through a single `DirectionalIcon`/`.flip-x` convention. (Fixes UX-07.)

## Shared primitives to standardise on (§86)

`PageHeader` · `SectionHeader` · `DataTable` (sort/filter/column-visibility/saved-view/row-action/
sticky-header/pagination) · `Toolbar`/`FilterBar` · `StatusBadge` · `Metric` · `Drawer` · `Dialog` ·
`Tabs`/`TabBar` · `EmptyState` · `ErrorState` · `ActivityTimeline` · `EntityHeader` · `FormField` ·
`DetailSection` · `CommandPalette`.

**Enforcement:** route the 20 hand-rolled detail headers to `PageHeader`, the 11 raw `<table>`s
(accounting cluster) to `DataTable`, and standardise `TabBar` across detail pages. This is the biggest
consistency win and is mechanical, not creative.

## Detail-page pattern (apply consistently, not identically)

Header (identity · status · primary/secondary actions) → Summary/metadata → primary operational
workspace → related records → files → comments → activity → financials (where authorised). Use
`TabBar` for the sections; keep the header and status treatment identical across entities.

## Drawer vs full page (§71)

- **Drawer:** fast create/edit, small focused action.
- **Full page:** complex transaction, workflow workspace, financial entry (journal, reconciliation),
  large regulatory/design detail. Stop mixing the two for the same weight of task.

## Navigation & IA (§62/§63)

Keep the grouped sidebar; separate Admin/Finance/Developer sections; lean on Cmd-K + favorites/recent
rather than growing the sidebar. Every record's related info lives under its detail `TabBar`, not in a
parallel place.

## Dashboards & charts (§64/§81)

Every number answers: what happened / good-or-bad / needs action / drill-down. Prefer attention queues,
sparklines, comparisons and trends over big KPI boxes. Charts must earn their place (a decision
question), with proper number formatting, dark-mode and RTL labels.

## Finance UI (§82)

Correctness over minimalism. Journal workspace, reconciliation, statements stay dense and explicit;
numbers render LTR inside RTL with tabular figures and the KWD 3-dp precision intact.

## What NOT to do

No shadcn-demo look, no old-ERP chrome, no giant KPI cards, no random per-status colours, no cheap
gradients/neon/glass, no domain-logic rewrites because a card looks dated. Refactor shared primitives;
don't patch every page independently.
