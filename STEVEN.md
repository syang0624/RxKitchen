# STEVEN — Workstream A: Data & Agent Generation Pipeline

> Owner: Steven (`steven` branch) · Counterpart: [NORI.md](NORI.md) · Source of truth: [PRD.md](PRD.md)

## Mission

Own everything that happens **offline, before the demo**: the synthetic dataset, the Claude-powered generation pipeline, and the pre-generated agent event streams that Nori's dashboard replays (PRD §6). Your output is a set of frozen JSON artifacts; Nori's app never calls an LLM.

## Deliverables

| Artifact | Contents | PRD ref |
| --- | --- | --- |
| `data/clients.json` | ~150 synthetic client profiles; **Client 1042 verbatim as the hero case** | §6, §7 |
| `data/meals.json` | ~80 meals with full nutrition (sodium, carbs, allergens, cuisine, diet tags) | §6, §7 |
| `data/inventory.json`, `data/donations.json`, `data/kitchen.json`, `data/delivery.json` | Stock, incoming donations, kitchen capacity slots, delivery zones/windows | §6, §7 |
| `data/agent_runs/*.json` | Per-referral ordered event streams: agent "thoughts", tool calls, constraint checks, outputs — authored by Claude offline | §6 |
| `data/scenarios/` | `happy_path` (Client 1042 end-to-end) and `stockout_replan` (stretch) | §6 |
| `scripts/generate.*` | The generation pipeline itself (Python or Node calling the Claude API) | §6 |

## Task order (maps to PRD §10)

### Phase 1 — hours 0–8 (critical path, Nori is blocked on schemas)

1. **Freeze the JSON schemas first** (data model in PRD §7: `ClientProfile`, `Meal`, `GroceryItem`, `Donation`, `KitchenCapacity`, `Allocation`, `ProductionPlan`, `DeliveryBatch`) **plus the agent-run event schema**. Commit them early — this is the contract Nori builds against, and per §11 the event schema is the v2 API contract.
2. Write the Claude-powered generator for clients, meals, inventory, donations, kitchen, delivery.
3. Generate and **hand-verify the Client 1042 hero run**: diabetes + cardiovascular, peanut allergy, ≤600 mg sodium/meal, 45–60 g carbs/meal, Filipino cuisine pref, microwave-only, dislikes lentils (§4).

### Phase 3 — hours 16–32 (with Nori)

4. Wire real `agent_runs` into Nori's replay engine; iterate on event pacing/reasoning text so the feed reads as honest agent work (§11: agents should visibly consider and reject options).

### Phase 4 — hours 32–44

5. Batch-run all ~150 clients through the pipeline; generate the `stockout_replan` second event stream (FR10).

### Phase 5 — final 4 h

6. **Freeze the dataset.** Run Nori's validators over the entire dataset in CI/build; regenerate (never hand-edit) any failing allocation (§11).

## Hard rules

- **Constraint hierarchy (§5) is non-negotiable in generated data:** allergens, sodium ceiling, carb range, and diet-order rules are never violated — a failing meal is excluded, never scored down. Fallback ladder: existing meal → new kitchen batch → grocery kit.
- **Never hand-edit nutrition numbers** — regenerate instead (§11).
- The headline demo metric is **0 clinical violations, computed live by Nori's validators** — your data must actually pass, not look like it passes.

## Status (updated 2026-07-16)

- ✅ **Schemas frozen** in `schemas/` — one JSON Schema per data artifact plus `agent_run.schema.json` (the replay-engine event contract, which per PRD §11 is also the v2 live API contract). `npm run data:validate` now fails on any contract drift, before the clinical checks.
- ✅ **Deterministic dataset** generated and validated: 0 violations, 98% compliant matches, 100% coverage, 76.9% donation utilization (`scripts/generate-data.mjs`).
- ✅ **Claude generation pipeline** ready: `npm run agents:generate -- --client <id>` (or `--clients a,b,c` / `--limit N`) authors agent event streams offline via the Claude API (`claude-opus-4-8`). Prompts contain only facts recomputed from `data/` (shared rules in `scripts/lib/clinical.mjs`); outputs are grounding-audited (no invented meals/numbers/IDs, pass claims must match the allocation) and schema-validated before writing. Needs `ANTHROPIC_API_KEY` or `ant auth login`.
- ⏭ Next: run the pipeline over the queue (start with `--client 1042 --force` to replace the templated hero run, then `--limit` batches), and generate the stockout stream variant.

## Interface with Nori

- You produce JSON; Nori consumes it statically. Any schema change after Phase 1 must be coordinated on the spot.
- Nori's client-side validators are the safety net for your data — treat a validator failure as a generation bug, not a validator bug (unless it demonstrably is).
- Shared checkpoints: end of Phase 1 (schemas + hero run), Phase 3 integration, Phase 5 dataset freeze.
