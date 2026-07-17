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

## What already exists (don't rebuild)

- `src/components/Dashboard.tsx` — shell with intake queue, scenario switching (happy path / stockout swap), kitchen/delivery/scale tabs
- `src/lib/replay.ts` — replay engine with speed (0.5–4×), pause, scrub, skip-to-end; `ActivityFeed` exposes the scrub slider
- `src/lib/validators.ts` — client-side hard-constraint re-verification powering the live metrics banner (FR6)
- `src/lib/types.ts` — TS mirror of the frozen contract in `schemas/`
- All FR1–FR7 views plus scale view (FR8), delivery panel (FR9), stockout trigger (FR10)

## Backlog (priority order)

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
