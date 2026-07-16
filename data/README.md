# NourishOS Synthetic Dataset

All data here is **generated — never hand-edit** (PRD §11). To change anything, edit
`scripts/generate-data.mjs` and regenerate. The generator is seeded and fully
deterministic: the same command always produces byte-identical output.

```bash
npm run data:generate    # regenerate everything in data/
npm run data:validate    # schema conformance + zero clinical violations (also runs before `npm run build`)
npm run agents:generate -- --client 1042 --force   # author an agent run offline via the Claude API
```

Every file conforms to the frozen JSON Schemas in `schemas/` — that directory is
the contract between the data pipeline and the app; the validator fails the build
on any drift. `agent_runs/*.json` carry a `generator` field: `"template"`-less
files were produced deterministically by `generate-data.mjs`; Claude-authored
runs record the model id.

## Contents

| File | What it is | Count |
| --- | --- | --- |
| `clients.json` | Synthetic client profiles; **Client 1042 is the scripted hero case** | 150 |
| `meals.json` | Meals with nutrition, allergens, diet tags, stock | 80 (8 cuisines × 10) |
| `inventory.json` | Grocery items for fallback kits | 25 |
| `donations.json` | Incoming donations with triage status and routing | 12 |
| `kitchen.json` | Daily kitchen capacity (labor hours, equipment slots) | 3 days |
| `delivery.json` | Zones + delivery route batches grouped by zone | 10 zones, 16 routes |
| `allocations.json` | Per-client weekly allocation output with per-item constraint checks | 150 |
| `production_plan.json` | Kitchen batches (B1 adobo / B2 congee / B3 cod) fed by donations | 3 batches |
| `agent_runs/client-1042.json` | Hero event stream: intake → matching → kitchen → donation → delivery | 23 events |
| `agent_runs/client-1042-stockout.json` | Stress-beat stream: stock depletion re-plan (FR10) | 6 events |
| `scenarios/` | `happy_path` and `stockout_replan` scenario manifests | 2 |

## Dataset guarantees (verified by `scripts/validate-data.mjs`)

- **0 clinical violations** — every allocated item re-checked against allergens,
  sodium ceiling, carb range, diet-order tags, and cooking ability.
- **98.0%** of clients matched to fully compliant meals (fallback level 0/1); the
  remaining 3 clients are covered by grocery kits — **100% coverage**.
- **76.9% donation utilization** (routed to inventory or production batches).
- Stock feasibility: total demand per meal ≤ current stock + scheduled batch quantity.

## Key conventions

- `fallback_level`: `0` existing meals · `1` includes meals from a new kitchen batch · `2` grocery kit (PRD §5 fallback ladder).
- `agent_runs` events: `{seq, t_offset_ms, agent, type, title, detail, data?}` with
  `agent ∈ {orchestrator, intake, matching, kitchen, donation, delivery, fallback}` and
  `type ∈ {status, thought, check, output}`. Replay by scheduling each event at `t_offset_ms`.
- Diet-order → required meal tag: `diabetic → diabetic-friendly`, `cardiovascular → heart-healthy`,
  `renal → renal-friendly`, `low-sodium → heart-healthy`. Tags are derived from the nutrition
  numbers in the generator, so tags and numbers can never disagree.
- Demo week is fixed at **2026-07-20** (Mon); deliveries on 2026-07-21.
