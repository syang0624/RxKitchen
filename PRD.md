# PRD: NourishOS — Agentic Clinical Meal Allocation for Project Open Hand

**Version:** 1.0 (Hackathon POC)
**Team size:** 1–3 · **Timeline:** 24–48 hours
**Primary user:** Project Open Hand (POH) dietitians / nutrition staff

---

## 1. Problem Statement

Medically tailored meal (MTM) organizations like Project Open Hand sit at a brutal intersection: on one side, hospitals discharge patients with strict clinical dietary prescriptions (diabetes, cardiovascular, renal, allergies); on the other side, a food-bank-style supply chain with unpredictable donations, finite inventory, limited kitchen capacity, and delivery constraints. Today, dietitians manually reconcile these two worlds — matching each client's medical profile against what's actually on the shelf and what the kitchen can produce. This is slow, error-prone at scale, and means donations often go underused while clients wait or receive imperfect matches.

NourishOS is a multi-agent AI system that fully automates this reconciliation: it ingests a hospital referral and autonomously produces (a) a per-client allocation of existing meals and groceries that satisfies every clinical constraint, and (b) a kitchen production plan for what must be prepared. The dietitian watches the agents work in real time on a live dashboard, and the demo tells one continuous story: **a referral arrives from a hospital, and minutes later a complete, clinically-safe doorstep plan exists.**

## 2. Goals and Non-Goals

**Goals (what winning looks like at demo time):**

1. Demonstrate an end-to-end autonomous pipeline: hospital referral → client profile → meal/grocery allocation → kitchen production plan → delivery batch.
2. Zero clinical violations across the entire demo dataset — this is the headline metric. No allergen, sodium, or carbohydrate limit is ever breached.
3. Show a graceful fallback: when no existing meal fits a client, the agent composes a grocery bundle with prep instructions matched to the client's cooking ability (e.g., microwave-only).
4. Make the agent reasoning _visible and legible_ through a live activity feed, so judges see specialist agents collaborating rather than a black box.

**Non-Goals (explicitly out of scope for the POC):**

- HIPAA compliance, real EHR/FHIR integration, or real patient data (all data is synthetic).
- Live LLM inference during the demo (all agent outputs are pre-generated; see §6).
- Human-in-the-loop approval workflows (agents are fully autonomous in this POC).
- Real routing APIs, real inventory systems, payments, or multi-tenant support.
- Production-grade auth, persistence, or scalability.

## 3. Users

**Primary: POH Dietitian (persona: "Maria").** Currently spends hours per referral cross-referencing diet orders, allergen lists, nutrition labels, and inventory spreadsheets. She needs confidence that nothing unsafe ships, visibility into _why_ the system chose what it chose, and a plan she can hand to the kitchen and drivers.

**Secondary (represented in the demo but not interactive):** hospital discharge coordinators (source of referrals), kitchen managers (consumers of the production plan), and delivery coordinators (consumers of the route batch).

## 4. The Demo Narrative ("Wow Moment")

The demo is a single ~4-minute story, replayed on a Next.js dashboard:

1. **Referral lands.** A synthetic HL7-style referral for _Client 1042_ appears in the intake queue: diabetes + cardiovascular diet, peanut allergy, ≤600 mg sodium/meal, 45–60 g carbs/meal, prefers Filipino food, microwave-only, dislikes lentils.
2. **Agents activate.** The activity feed lights up: the Intake Agent parses and structures the referral; the Clinical Matching Agent scores every meal in inventory against the constraint hierarchy; the Kitchen Planning Agent notices a shortfall in compliant Filipino-style meals and schedules a low-sodium chicken adobo batch within today's remaining kitchen capacity; the Donation Triage Agent flags an incoming rice donation as usable for that batch; the Delivery Agent slots the client into an existing Tenderloin route.
3. **Plan materializes.** The client's card fills in: 5 matched meals (each showing sodium/carb/allergen checks passing), a grocery bundle with microwave prep instructions covering the gap days, and a delivery window.
4. **Scale reveal.** Camera pulls back: the same pipeline just processed 150 synthetic clients. Metrics banner: **0 clinical violations · 94% of clients matched to fully compliant meals · 78% donation utilization.**
5. **Stress beat (stretch goal).** One meal's stock is marked depleted; the feed shows agents re-planning that client's allocation live (a second pre-generated scenario).

## 5. System Architecture

Multi-agent architecture with a central orchestrator. Each specialist agent has a narrow contract; the orchestrator sequences them and owns the global state.

| Agent                                         | Responsibility                                                                                                                                         | Key output                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| **Orchestrator**                              | Sequences the pipeline per referral; owns global state; enforces the constraint hierarchy; emits activity-feed events                                  | Pipeline status, event log                          |
| **Intake Agent**                              | Parses the hospital referral into a structured client profile (diets, allergies, hard limits, preferences, cooking ability)                            | `ClientProfile` JSON                                |
| **Clinical Matching Agent**                   | Scores every existing meal/grocery item against the client's hard constraints (allergens, sodium, carbs) then soft preferences (cuisine, dislikes)     | Ranked `Allocation` with per-item constraint checks |
| **Kitchen Planning Agent**                    | Aggregates unmet demand across clients; proposes production batches that fit kitchen capacity (labor hours, equipment slots) and available ingredients | `ProductionPlan`                                    |
| **Donation Triage Agent**                     | Classifies incoming donations (usable-as-is / kitchen ingredient / non-compliant), routes them into inventory or production plans                      | Inventory updates, triage log                       |
| **Delivery Agent**                            | Batches clients into delivery routes given zones, time windows, and cold-chain limits                                                                  | `DeliveryBatch`                                     |
| **Fallback Composer** (sub-agent of Matching) | When no compliant meal exists: composes a grocery substitution bundle + step-by-step prep instructions constrained by the client's cooking ability     | `GroceryKit` with instructions                      |

**Constraint hierarchy (non-negotiable, enforced by orchestrator):**

1. **Hard / never violated:** allergens, sodium ceiling, carbohydrate range, diet-order rules. A meal failing any hard check is excluded — never "scored down."
2. **Soft / optimized:** cuisine preference, dislikes, variety across the week, donation utilization, kitchen cost.
3. **Fallback ladder:** compliant existing meal → compliant meal from new kitchen batch → grocery kit + prep instructions. Preferences may be relaxed; clinical limits never are.

## 6. Implementation Strategy: Pre-Generated Agent Intelligence

This is the critical hackathon decision. **All LLM reasoning happens offline, before the demo.** A generation pipeline (Python or Node script calling the Claude API) produces the complete dataset and every agent decision, serialized as JSON. The Next.js app is a deterministic playback engine with rule-based interactivity — zero live inference, zero API risk on stage.

**Offline generation pipeline produces:**

- `clients.json` — ~150 synthetic client profiles (varied diets, allergies, limits, cuisines, cooking abilities), including Client 1042 verbatim as the hero case.
- `meals.json` — ~80 meals with full nutrition data (sodium, carbs, allergens, cuisine tags), modeled on POH's real menu style (e.g., low-sodium adobo, congee, heart-healthy sinigang) without copying it.
- `inventory.json`, `donations.json`, `kitchen.json` (capacity slots, labor hours), `delivery.json` (zones, windows).
- `agent_runs/*.json` — for each referral, an ordered event stream: every agent's "thoughts," tool calls, constraint-check results, and final outputs, with realistic reasoning text authored by Claude offline. This is what the activity feed replays.
- `scenarios/` — at least two: `happy_path` (Client 1042 end-to-end) and `stockout_replan` (stretch).

**Next.js app (App Router, TypeScript, Tailwind):**

- Loads the JSON artifacts statically; replays `agent_runs` events on a timer to simulate live agent activity (configurable speed, pause/scrub for judge Q&A).
- Rule-based validators run client-side and re-verify every allocation against hard constraints in real time — so the "0 violations" banner is _computed live from data_, not hardcoded. This is honest and demoable: judges can inspect any meal card and see the checks pass.
- Deterministic interactions: clicking a client shows their full plan and reasoning trail; triggering the stockout scenario swaps in the second pre-generated event stream.

## 7. Data Model (Synthetic)

**ClientProfile:** `id, name, referring_hospital, diet_orders[], allergies[], max_sodium_mg, carb_range_g, cuisine_pref, dislikes[], cooking_ability (none|microwave|stovetop|full), address_zone, meals_per_week`

**Meal:** `id, name, cuisine, sodium_mg, carbs_g, allergens[], diet_tags[], stock_qty, source (kitchen|donated|purchased), reheat_method`

**GroceryItem:** `id, name, nutrition, allergens[], stock_qty, prep_complexity`

**Donation:** `id, items[], received_at, condition, triage_status`

**KitchenCapacity:** `date, labor_hours_available, equipment_slots, batch_min/max`

**Allocation (output):** `client_id, week, items[{meal_or_grocery_id, qty, day, constraint_checks{allergen: pass, sodium: pass(value), carbs: pass(value)}}], grocery_kit?{items[], prep_instructions[]}, fallback_level (0|1|2)`

**ProductionPlan (output):** `date, batches[{meal_id, qty, labor_hours, ingredients_from[donation_ids]}], capacity_utilization`

**DeliveryBatch (output):** `route_id, zone, clients[], window, cold_chain_ok`

## 8. Functional Requirements

**P0 — must exist for the demo:**

- FR1: Intake queue view showing incoming referrals; selecting one starts the pipeline replay.
- FR2: Live agent activity feed — timestamped events per agent with reasoning snippets, streaming in with realistic pacing.
- FR3: Client plan card — matched meals with visible per-constraint pass indicators (allergen ✓, sodium 480/600 mg ✓, carbs 52 g ✓), preference-match badges, and dislike avoidance.
- FR4: Grocery-kit fallback rendering — itemized bundle plus numbered microwave-safe prep instructions when `fallback_level = 2`.
- FR5: Kitchen production plan view — batches, quantities, capacity bar, which donations feed which batch.
- FR6: Metrics banner computed live by client-side validators: clinical violations (must read 0), % fully compliant matches, donation utilization %.
- FR7: Client 1042 works flawlessly as the scripted hero path.

**P1 — strongly desired:**

- FR8: Scale view — table/grid of all ~150 clients with match status; batch-run animation.
- FR9: Delivery route panel — clients grouped by zone with time windows (static map image acceptable).
- FR10: Stockout re-plan scenario trigger.

**P2 — stretch:**

- FR11: "Explain this decision" drawer showing the full pre-generated reasoning chain for any allocation.
- FR12: Donation intake simulator (drop a new donation, watch triage classify it — second pre-generated stream).

## 9. Success Metrics (Judge Pitch, in priority order)

1. **Zero clinical violations** — verified live by client-side validators over the full dataset, not asserted. Safety is the product.
2. **% clients matched to fully compliant meals** — target ≥90% via existing meals + kitchen batches; remainder covered by grocery kits (100% coverage overall).
3. **Donation utilization** — % of donated items routed into allocations or production batches (target ~75–80% vs. an implied manual baseline).
4. **Time saved** — framed narratively: minutes per referral for the pipeline vs. the ~hours a dietitian spends today.

## 10. Build Plan (24–48 h, 1–3 people)

**Phase 1 (hours 0–8): Data + generation pipeline.** Define JSON schemas; write the Claude-powered generator for clients, meals, inventory; generate and hand-verify the Client 1042 hero run. _Owner: person A._

**Phase 2 (hours 4–20, parallel): Next.js shell.** Layout (intake queue, activity feed, client card, metrics banner), event-replay engine, client-side constraint validators. _Owner: person B._

**Phase 3 (hours 16–32): Integration.** Wire generated `agent_runs` into the replay engine; kitchen plan + fallback grocery-kit views; polish pacing of the feed.

**Phase 4 (hours 32–44): Scale + stretch.** Batch-run all 150 clients through the offline pipeline; scale view; stockout scenario if time allows.

**Phase 5 (final 4 h): Demo hardening.** Script the 4-minute narrative, add pause/scrub, freeze the dataset, rehearse.

**Cut lines if behind:** drop P2 first, then delivery panel (FR9), then scale animation (keep the static metrics banner — it carries the scale story on its own).

## 11. Risks and Mitigations

- **Pre-generated data has a hidden clinical violation** → the client-side validator is the safety net; run it over the entire dataset in CI/at build time and regenerate any failing allocation before demo day. Never hand-edit nutrition numbers.
- **Activity feed reads as fake** → include imperfect-but-honest reasoning (agents considering and rejecting meals with reasons), variable timing, and the live validator so the intelligence is inspectable.
- **Scope creep on the UI** → the activity feed + client card + metrics banner _are_ the product; everything else is garnish.
- **Judge asks "is this live?"** → answer honestly: reasoning is pre-computed by Claude offline for demo reliability; the validation is live; the production path swaps the replay engine for live agent calls behind the same event contract (the JSON event schema _is_ the API contract for v2).

## 12. Future Path (post-hackathon, one paragraph for the pitch)

The same event contract powering the replay becomes the live API: agents run on-demand against real inventory feeds, referrals arrive via FHIR from partner hospitals, dietitians move from spectators to approvers for edge cases, and the system extends from POH to any MTM organization or food bank offering health-conditioned distribution. HIPAA compliance, EHR integration, and human-in-the-loop controls are the first three production workstreams.
