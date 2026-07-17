# STEVEN — Round 2: Frontend (Dashboard & Demo Experience)

> Owner: Steven (`steven` branch) · Counterpart: [NORI.md](NORI.md) · Source of truth: [PRD.md](PRD.md)
>
> **Roles swapped after the Phase 1–4 merge (2026-07-16):** Steven now owns the
> frontend; Nori owns the backend/data pipeline. Round 1 recap is at the bottom.

## Mission

Own everything the judges see and touch: the Next.js dashboard, the replay
experience, and the 4-minute demo narrative (PRD §4). The shell Nori built in
round 1 covers FR1–FR10 — your job is to finish the P1/P2 features, absorb the
richer Claude-authored runs as Nori lands them, and harden the demo.

**Primary user (refined from PRD §3):** the **Chief Nutrition Officer — not
technical at all** — who uses this to plan meal schedules. Every screen must
work for someone who has never seen a JSON file or a terminal:

- Plain language everywhere: "Safe — no allergens" beats `allergen: pass`;
  "Sodium 480 of 600 mg" beats `480/600mg ✓`. No IDs as primary labels (say
  "Rosa Dela Cruz", show `#1042` as secondary detail).
- Big, obvious, forgiving controls — one clear primary action per screen,
  generous hit targets, no hover-only affordances, nothing destructive.
- The weekly meal schedule is her mental model: lead with days-of-the-week
  views (Mon–Sun plan per client), not data tables.
- She must always be able to answer "is this safe, and why?" in one glance —
  constraint results stay front and center, spelled out in words.

## What already exists (don't rebuild)

- `src/components/Dashboard.tsx` — shell with intake queue, scenario switching (happy path / stockout swap), kitchen/delivery/scale tabs
- `src/lib/replay.ts` — replay engine with speed (0.5–4×), pause, scrub, skip-to-end; `ActivityFeed` exposes the scrub slider
- `src/lib/validators.ts` — client-side hard-constraint re-verification powering the live metrics banner (FR6)
- `src/lib/types.ts` — TS mirror of the frozen contract in `schemas/`
- All FR1–FR7 views plus scale view (FR8), delivery panel (FR9), stockout trigger (FR10)

## Design system (mandatory): NEOBRUTALISM, Poolsuite-inspired

Act as an expert UI/UX designer. Build every component against this exact
design system — do not mix in other aesthetics, and do not keep the current
dark zinc theme.

**Design vibe:** NEOBRUTALISM. High-contrast **2px hard black borders on ALL
containers and buttons**. **No soft shadows** — hard offset shadows only
(`4px 4px 0px 0px #000000`). Clashing neon colors on cream backgrounds. Bold,
slightly weird typography. Ignore standard subtle spacing guidelines.

| Token | Value |
| --- | --- |
| Background | `#FFFDF5` (cream) |
| Primary | `#8B5CF6` (violet) |
| Secondary | `#A3E635` (lime) |
| Text | `#000000` |
| Mode | Light |
| Border radius | `4px` |
| Border style | `2px solid #000000` |
| Shadow | `4px 4px 0px 0px #000000` |

**Typography:** headings in **"Lexend Mega"** — uppercase, bold; body in
**"Public Sans"**; monospaced for details/numbers (sodium values, IDs,
timestamps). Both fonts are on Google Fonts — load via `next/font/google`
(`Lexend_Mega`, `Public_Sans`) in `src/app/layout.tsx`.

Implementation notes for this codebase:

- Define tokens once in `src/app/globals.css` (Tailwind v4 `@theme`):
  `--color-background: #FFFDF5; --color-primary: #8B5CF6;
  --color-secondary: #A3E635;` plus a shared `.brutal` utility
  (`border: 2px solid #000; border-radius: 4px; box-shadow: 4px 4px 0 0 #000`).
- Retheme `src/components/ui.tsx` first — every card/button/badge inherits
  from there. Interactive elements: translate down-right + shadow collapse on
  press (`active:translate-x-[4px] active:translate-y-[4px] active:shadow-none`)
  is the canonical neobrutalist press state.
- Keep semantics loud but on-palette: pass/safe states lean on the lime
  secondary, attention states on the violet primary; failures stay
  unmistakable (black on a hot accent), never a muted gray.
- Reference: Poolsuite (https://poolsuite.net) — creative category. Stay pure
  to this system.

## Product decisions (2026-07-16, from the CNO persona review)

- **Delivery feature removed** (was FR9/P1 — also the PRD's first cut line).
  `DeliveryPanel` and the per-client route section are gone; the delivery
  data files remain in `data/` untouched.
- **Holistic first**: the landing view is now `WeeklyCookList` — the week's
  aggregated cook list (servings per meal, Mon–Sun, plus fresh batches)
  across all 150 clients. The CNO plans cooking for everyone, not one plate
  at a time. Individual plans live behind the "Client plans" tab.

- **Workflow layer (2026-07-16):** the CNO now *does* things, not just reads
  them — an action inbox (review new referral / approve weekly menu / triage
  donation), approval states persisted in localStorage (`src/lib/workflow.ts`),
  menu approval gated on zero live-verified safety issues, and a print-only
  kitchen production sheet (`KitchenPrintSheet`, browser print).

- **Admin layer (2026-07-16):** the CNO can now change things, not just
  approve them — per-day meal swaps (picker offers only alternatives passing
  every safety check; `src/lib/overrides.ts`), week holds (client drops out of
  cooking/counts/print), a first-visit HelpGuide, all persisted and included
  in the demo reset.

## Backlog (priority order)

0. **Reskin to the design system above + non-technical usability pass.** Do
   this before (or together with) new features so everything lands styled:
   fonts in `layout.tsx`, tokens in `globals.css`, `ui.tsx` primitives, then
   sweep every component. While sweeping, apply the CNO persona rules — plain
   language, day-of-week meal schedule framing, no raw IDs/jargon.
1. **Per-client replay (finish FR8).** `data/agent_runs/` now has a run for
   *every* client, but `src/lib/data.ts` statically imports only the hero +
   stockout streams, and `Dashboard.tsx` hardcodes `EMPTY_EVENTS` for non-hero
   clients. Load `client-<id>.json` on demand (dynamic `import()` keeps the
   initial bundle small) so clicking any client in the scale view or intake
   queue replays their pipeline run.
2. **FR11 — "Explain this decision" drawer (P2).** For any allocation item,
   show the reasoning trail: the constraint checks, the run events that
   reference that `meal_id`, and why alternatives were rejected. The per-item
   `constraint_checks` and event `data.meal_id` refs are already in the data.
3. **Absorb Claude-authored runs.** When Nori upgrades runs (the `generator`
   field flips from `"template"` to a model id), streams get longer and more
   deliberative. Re-check feed pacing, autoscroll, and the hero narrative
   timing at 1× speed (~4 min target); surface `generator` subtly if useful
   for judge Q&A ("reasoning pre-computed by Claude offline" — PRD §11).
4. **FR12 — donation intake simulator (P2, first cut line).** Drop a new
   donation, watch the triage stream replay. Blocked on Nori producing the
   pre-generated donation-sim stream — coordinate before building UI.
5. **Phase 5 — demo hardening (final 4 h).** Script the 4-minute narrative
   against the real dataset; add keyboard shortcuts (space = pause, arrows =
   scrub) for judge Q&A; static map image for the delivery panel if time
   permits (FR9 allows it); rehearse the stockout beat.

**Cut lines if behind (PRD §10):** FR12 → FR11 → delivery-panel polish. The
activity feed + client card + metrics banner *are* the product (§11).

## Hard rules (unchanged from round 1)

- **The metrics banner is computed live by the validators — never hardcoded** (§6, §9).
- Deterministic only: no LLM calls, no network dependencies at demo time. All data loads from `data/` at build time (dynamic imports of bundled JSON are fine; fetches are not).
- Don't hand-edit anything in `data/` — that's Nori's regeneration pipeline. Frontend needs a data change → ask Nori.

## Interface with Nori

- `schemas/` is the frozen contract; `src/lib/types.ts` mirrors it. Any contract change is a joint edit (schema + types + both validators) — never drift silently.
- Validator parity: `src/lib/validators.ts` (yours now) and `scripts/validate-data.mjs` (Nori's) must enforce identical rules.
- Shared checkpoints: Claude-run upgrade of the hero (re-time the narrative together), donation-sim stream handoff (FR12), Phase 5 dataset freeze.

---

## Round 1 recap (done, merged to main)

Steven built the backend in round 1: deterministic dataset generator
(`scripts/generate-data.mjs` — 150 clients, 80 meals, allocations with 0
violations), frozen schemas (`schemas/`), independent validator wired into
build + CI, per-client template agent runs, and the Claude generation pipeline
(`scripts/generate-agent-runs.mjs`, happy + stockout scenarios, grounding
audit). All of that is now **Nori's** to operate and extend.
