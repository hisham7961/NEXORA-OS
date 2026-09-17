# NEXORA — UI/UX Audit

**Audit branch:** `claude/nexora-360-audit` · **Date:** 2026-09-17
Basis: code-truth design-system review (tokens, components, computed contrast) + live Playwright
screenshot matrix (EN/AR × light/dark, desktop + mobile). Quality bar: Linear / Attio / Stripe.

## Verdict in one line

The **foundations are unusually good** — disciplined RTL, one icon system, a controlled 5-category
status-colour model, restrained dashboards, no-FOUC dark mode — but three systemic issues keep it at
"functional" rather than "premium", and one accessibility primitive is broken app-wide.

## What is already right (keep)

- **RTL discipline is exemplary**: zero physical-direction utilities (`ml-/mr-/left-/text-left/border-l-`);
  everything is logical (`ms/me/ps/pe/start/end`). Rare in enterprise apps.
- **Single icon family** (lucide, 136 files, no competing libraries).
- **Status colour is a system**, not random-per-status: 5 semantic categories via a central `StatusBadge`.
- **Dashboards are restrained** — no giant-KPI-box wall; Command Center/My Day are sensibly composed.
- **Runtime**: 0 horizontal overflow at 1440 in LTR *and* RTL; icon-only buttons are almost all labelled.

## UX-P1 — fix first (serious: prevents premium feel or blocks a11y)

1. **UX-01 — the brand font never loads.** `--font-sans` names "Inter" but there is no `next/font`,
   `@font-face`, or stylesheet link anywhere, so the app renders in the OS system font and Inter's
   `font-feature-settings` are inert. This is the single biggest reason it reads "generic" next to
   Linear/Attio. *Fix:* load Inter (or Geist) via `next/font` with the Arabic subset for the RTL face.
2. **UX-02/03 — token contrast fails WCAG AA (light mode).** `--ink-3` computes 2.6–2.97:1 (used for
   table headers, hints, placeholders, timestamps, pagination) and status-badge text on soft fills is
   2.86 (warning) / 3.24 (success) / 3.97 (info) / 4.00 (critical) — all below 4.5. This is ubiquitous
   (44+ badge sites). *Fix:* darken `--ink-3` and the on-soft badge text tokens; re-validate both themes.
3. **UX-13 — forms have no label association.** The shared `FormField` renders `<label>` as a sibling
   with no `id`/`htmlFor`, so **every** create/edit form lacks label↔input association (no click-to-focus,
   unreliable screen-reader announcement). *Fix:* `useId()` + `htmlFor`/`id` in the one primitive.

## UX-P2 — high-value productivity/consistency

- **UX-09/10/11 — shared primitives are bypassed.** 20 of 30 detail pages hand-roll `<h1>`+breadcrumb
  instead of `PageHeader`; a raw `<table>` appears in 11 files (the accounting cluster) instead of
  `DataTable`; `TabBar` is used on only 5 detail pages. Consequence: inconsistent density, spacing and
  behaviour. *Fix:* route these through the shared primitives (a refactor, not a redesign).
- **UX-07 — RTL directional icons not mirrored.** Only 3/10 directional icons use the existing `.flip-x`;
  dashboard/command-palette/workflow arrows point the wrong way in Arabic.
- **UX-14 — Drawer/CommandPalette have no focus trap or focus restore** (keyboard/AT users can tab out
  of an open drawer).
- **UX-17 — Drawer animates `slide-up` (bottom sheet)** while its own RTL `drawer-in` keyframes are dead
  code — contradicts the intended "slides from inline-end".
- **UX-04/06** — loading/empty-state consistency; a couple of dense tables need sticky headers.
- **RT-02 (runtime)** — `/answers` hydration mismatch (React #418) flashes/re-renders on load.
- **RT-03 (runtime)** — `/admin/go-live` never settles (perceived hang for admins doing rollout).

## UX-P3 — polish

Drawer keyframe cleanup, one icon-only-button label miss (UX-15), micro-spacing, consistent skeletons,
consistent error-state copy, chart tooltip/number-format polish.

## UX priority classification (§84)

| Class | Items |
|---|---|
| UX-P0 (prevents completion) | none found |
| UX-P1 | UX-01 font, UX-02/03 contrast, UX-13 form labels |
| UX-P2 | UX-07, 09, 10, 11, 14, 17, RT-02, RT-03 |
| UX-P3 | the rest |

Do UX-P1 and the high-impact UX-P2 (shared-primitive routing, RTL icons, focus trap). Do **not** spend
the budget polishing invisible 1% issues while forms lack label association and the brand font is absent.
