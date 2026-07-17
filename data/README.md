# RxKitchen Synthetic Dataset

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
on any drift. `agent_runs/*.json` carry a `generator` field: `"template"` means
the deterministic placeholder from `generate-data.mjs`; Claude-authored runs
record the model id instead. `data:generate` never overwrites a Claude-authored
run, so the two pipelines compose — regenerate the dataset freely, then upgrade
runs with `agents:generate` (use `--scenario stockout` for re-plan streams,
`--scenario donation` for the FR12 donation-intake sim).

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
| `agent_runs/client-<id>.json` | One replayable event stream per client (scale view, FR8); Client 1042's is the rich scripted hero stream | 150 runs |
| `agent_runs/client-1042-stockout.json` | Stress-beat stream: stock depletion re-plan (FR10) | 6 events |
| `agent_runs/client-1131-donation.json` | Donation-intake sim stream: D011 arrives, is triaged, and routed to batch B2 (FR12) | 7 events |
| `scenarios/` | `happy_path`, `stockout_replan`, and `donation_sim` scenario manifests | 3 |

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
- Donation `triage_status`/`routed_to` are likewise derived from the shared rule
  (`triageDonation` in `scripts/lib/clinical.mjs`): condition ≠ `good` →
  `non_compliant`; listed in a batch's `ingredients_from` → `kitchen_ingredient`
  routed to that batch; otherwise `usable_as_is` routed to inventory.
- **Donation-sim (FR12) contract:** `scenarios/donation_sim.json` carries an extra
  optional `donation_id` (schema-approved). Its run uses the standard `AgentRun`
  event shape — no new fields: `data.donation_id`/`data.batch_id` reference the
  sim donation (or the contrast rejection) and target batch;
  `data.result ∈ {pass, fail}` for the food-safety gate and
  `{kitchen_ingredient, usable_as_is, non_compliant}` for classifications. The
  anchor `client_id` is the first client whose plan draws from the target batch.
- Demo week is fixed at **2026-07-20** (Mon); deliveries on 2026-07-21.
