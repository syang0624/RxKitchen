# NORI — Round 2: Backend (Data, Generation Pipeline & CI)

> Owner: Nori (`nori` branch) · Counterpart: [STEVEN.md](STEVEN.md) · Source of truth: [PRD.md](PRD.md)
>
> **Roles swapped after the Phase 1–4 merge (2026-07-16):** Nori now owns the
> backend/data pipeline; Steven owns the frontend. Round 1 recap is at the bottom.

## Mission

Own everything that happens **offline, before the demo** (PRD §6): the dataset,
the schemas, the Claude generation pipeline, and CI. Your headline deliverable
for round 2 is upgrading the templated agent runs to Claude-authored reasoning
and freezing a demo-safe dataset.

## What already exists (don't rebuild)

- `scripts/generate-data.mjs` — seeded, deterministic dataset generator (regenerating never clobbers Claude-authored runs — the `generator` field guards it)
- `scripts/generate-agent-runs.mjs` — Claude pipeline (`claude-opus-4-8`): grounded facts in, grounding-audited + schema-validated event streams out; `--scenario stockout` for re-plan streams
- `scripts/lib/clinical.mjs` — shared hard/soft constraint rules
- `scripts/validate-data.mjs` — independent safety net: schema conformance + zero-clinical-violations, runs on `prebuild` and in CI
- `schemas/` — the frozen contract; `.github/workflows/ci.yml` — regenerability check + validate + lint + build
- `data/` — 150 clients, 80 meals, allocations (98% compliant matches, 0 violations), 151 agent runs (all `generator: "template"` so far)

## Backlog (priority order)

1. ~~**Upgrade agent runs with Claude**~~ **CANCELLED (decision 2026-07-16):**
   the demo ships with the deterministic template runs in `data/agent_runs/`
   as-is — no Claude API usage, no `ANTHROPIC_API_KEY` needed.
   `scripts/generate-agent-runs.mjs` stays in the repo unused (it is the v2
   path, PRD §11). All runs keep `generator: "template"`; Steven's backlog
   item "absorb Claude-authored runs" is moot.
2. **Donation-sim stream for FR12 (P2).** Steven's donation-intake simulator
   needs a second pre-generated stream: a new donation arrives → triage agent
   classifies it → routes to inventory or a batch. Add a
   `--scenario donation` mode to the pipeline (facts: the donation, its
   allergens/condition, the routing decision recomputed from rules) + a
   `data/scenarios/donation_sim.json` manifest. Coordinate the event shape
   with Steven before he builds UI; it must conform to `agent_run.schema.json`.
3. **Validator parity watch.** `scripts/validate-data.mjs` (yours) and
   `src/lib/validators.ts` (Steven's) must enforce identical rules. Any rule
   change is a joint edit: schema + both validators + regenerated data.
4. **Phase 5 — dataset freeze (final 4 h).** Regenerate, run the full
   validator, `npm run build`, then tag (`git tag demo-freeze`). After the
   freeze: no regeneration, no run upgrades. If a violation surfaces, fix the
   generator and regenerate — never hand-edit JSON (PRD §11).
5. **CI stewardship.** Keep `.github/workflows/ci.yml` green; it fails if
   committed `data/` drifts from the generator, on any schema/clinical
   violation, and on lint/build errors.

## Hard rules (unchanged)

- **Constraint hierarchy (§5) is non-negotiable:** allergens, sodium ceiling, carb range, diet-order rules are never violated in generated data — failing meals are excluded, never scored down.
- **Never hand-edit `data/`** — change the generator and regenerate (§11).
- Claude runs must survive the grounding audit: no invented meals, numbers, or IDs. If the audit rejects twice, fix the facts/prompt — don't loosen the audit.
- The demo metric is **0 violations computed live by Steven's client-side validators** — your data must actually pass.

## Interface with Steven

- `schemas/` is the frozen contract; Steven's `src/lib/types.ts` mirrors it. Contract changes are joint edits announced before merging.
- Steven is about to dynamic-import `data/agent_runs/client-<id>.json` per client — keep filenames and the `AgentRun` shape stable.
- Shared checkpoints: hero Claude-run upgrade (re-time narrative), donation-sim stream handoff (FR12), Phase 5 dataset freeze.

---

## Round 1 recap (done, merged to main)

Nori built the frontend in round 1: the full dashboard shell
(`src/components/` — intake queue, activity feed, client plan card, metrics
banner, kitchen plan, delivery panel, scale view), the replay engine with
speed/pause/scrub (`src/lib/replay.ts`), client-side validators
(`src/lib/validators.ts`), and the typed data layer. All of that is now
**Steven's** to operate and extend.
