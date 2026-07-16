# NORI — Workstream B: Next.js Dashboard & Replay Engine

> Owner: Nori (`nori` branch) · Counterpart: [STEVEN.md](STEVEN.md) · Source of truth: [PRD.md](PRD.md)

## Mission

Own the **Next.js app the judges actually see**: a deterministic playback engine (App Router, TypeScript, Tailwind) that loads Steven's pre-generated JSON statically, replays agent event streams as a live activity feed, and re-verifies every allocation with client-side validators — zero live inference, zero API risk on stage (PRD §6).

## Deliverables (P0 first — FR1–FR7 are the demo)

| Feature | What it is | PRD ref |
| --- | --- | --- |
| Intake queue | Incoming referrals list; selecting one starts the pipeline replay | FR1 |
| Agent activity feed | Timestamped per-agent events with reasoning snippets, streamed on a timer with realistic pacing; configurable speed + pause/scrub for judge Q&A | FR2, §6 |
| Client plan card | Matched meals with per-constraint pass indicators (allergen ✓, sodium 480/600 mg ✓, carbs 52 g ✓), preference badges, dislike avoidance | FR3 |
| Grocery-kit fallback view | Itemized bundle + numbered microwave-safe prep steps when `fallback_level = 2` | FR4 |
| Kitchen production plan view | Batches, quantities, capacity bar, donation→batch links | FR5 |
| **Live metrics banner** | Clinical violations (must read **0**), % fully compliant, donation utilization — **computed live by client-side validators, never hardcoded** | FR6, §9 |
| Hero path | Client 1042 replay works flawlessly end-to-end | FR7 |

**P1 (strongly desired):** scale view of ~150 clients (FR8), delivery route panel — static map ok (FR9), stockout re-plan trigger (FR10).
**P2 (stretch):** "explain this decision" drawer (FR11), donation intake simulator (FR12).

## Task order (maps to PRD §10)

### Phase 2 — hours 4–20 (start from Steven's frozen schemas)

1. Layout shell: intake queue, activity feed, client card, metrics banner.
2. **Event-replay engine**: consumes `agent_runs/*.json`, emits events on a timer (speed control, pause, scrub). Build against Steven's event schema — this schema is also the future live API (§11), so keep the engine swappable.
3. **Client-side constraint validators**: re-check every allocation against hard constraints (allergens, sodium, carbs, diet rules) in real time. This powers the honest "0 violations" banner and is the safety net for Steven's data (§11).
4. Use mock/fixture JSON matching the schemas until Steven's real artifacts land.

### Phase 3 — hours 16–32 (with Steven)

5. Swap in real `agent_runs`; build kitchen plan + grocery-kit views; polish feed pacing.

### Phase 4 — hours 32–44

6. Scale view + batch-run animation (FR8); stockout scenario trigger (FR10) swapping in the second pre-generated stream.

### Phase 5 — final 4 h

7. Demo hardening: script the 4-minute narrative (§4), pause/scrub polish, rehearse.

## Hard rules

- **The metrics banner is computed live from data by your validators — never hardcoded** (§6, §9). Judges may inspect any meal card and see the checks pass.
- Deterministic only: no LLM calls, no network dependencies at demo time.
- Scope discipline (§11): **the activity feed + client card + metrics banner are the product**; everything else is garnish. Cut order if behind: P2 → delivery panel (FR9) → scale animation (keep the static metrics banner).

## Interface with Steven

- You consume Steven's JSON statically; he owns generation. Report validator failures to him — he regenerates, nobody hand-edits data.
- Blocked until Steven freezes schemas (end of his Phase 1, hours 0–8) — use that window for layout + replay-engine scaffolding with fixtures.
- Shared checkpoints: schema freeze, Phase 3 integration, Phase 5 dataset freeze.
