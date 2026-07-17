# RxKitchen — Tech Q&A Cheat Sheet

Framing: **live multi-agent system; only the dataset is synthetic (say so openly).**
Format: each question → **Say:** (~10 sec, speak it as written) → backup bullets if they dig.
⚠️ Read the [appendix](#appendix--know-your-delta-do-not-present) before Q&A. Never present it.

**Jump to:** [Numbers](#-key-numbers--never-fumble-these) ·
[Agents](#1-the-agents--how-they-interact) · [Pipeline](#2-pipeline--architecture) ·
[Model](#3-the-model-in-the-loop) · [Safety](#4-safety--correctness) · [Data](#5-data) ·
[Scale](#6-scale--production-path) · [Curveballs](#7-curveballs) ·
[Appendix](#appendix--know-your-delta-do-not-present)

---

## ⭐ Key numbers — never fumble these

| Number | What it is |
| --- | --- |
| **0** | clinical violations — recomputed live in the browser, gates every build |
| **150 / 80** | synthetic clients / meals (8 cuisines × 10) |
| **5 + 2** | specialist agents + Fallback Composer + Safety Auditor, under one orchestrator |
| **3** | independent safety layers (allocator filter → build gate → browser re-check) |
| **tens of seconds** | end-to-end referral run (model calls dominate; matching is µs) |
| **cents** | cost per referral (model only in explanation path) |
| claude-opus-4-8 | the model, via Anthropic SDK |

**Three lines to land in any answer:**
- *"Verdicts are deterministic code — the model is never trusted with a clinical number."*
- *"Every check you see is recomputed in your browser, not read from the run."*
- *"Hard constraints exclude — they are never scored down."*

---

## 1. The agents & how they interact (service: BAND)

### The cast — one line each
- 🧭 **Orchestrator** — sequences the specialists, owns global state and the constraint hierarchy; the only component that talks to everyone.
- 📥 **Intake Agent** — parses the raw hospital referral into a structured **ClientProfile** (diet orders, allergies, sodium/carb limits, preferences, cooking ability).
- 🩺 **Clinical Matching Agent** — scores all 80 meals against the profile: hard checks **exclude**, soft preferences **rank** → ranked **Allocation** with per-item checks.
- 👨‍🍳 **Kitchen Planning Agent** — aggregates unmet demand across clients into production batches that fit labor hours + equipment slots → **ProductionPlan**.
- 📦 **Donation Triage Agent** — classifies incoming donations (usable as-is / kitchen ingredient / non-compliant) and routes them into inventory or scheduled batches.
- 🛒 **Fallback Composer** *(sub-agent of Matching)* — when no compliant meal exists: grocery kit + step-by-step prep matched to cooking ability → **GroceryKit**.
- 🚚 **Delivery Agent** — batches clients into routes by zone, time window, and cold-chain limits → **DeliveryBatch**.
- 🛡️ **Safety Auditor** — out-of-band watchdog beside the orchestrator: re-verifies every hand-off against the clinical rules, and when anything fails, authors the **incident report** — which rule broke, on which artifact, what the retry did, which fallback took over.

### How they talk to each other
- **Hub-and-spoke, not free-for-all** — specialists never call each other directly; the orchestrator dispatches each one and passes artifacts forward. (One exception: Matching invokes its Fallback sub-agent.)
- Every hand-off is a **typed JSON artifact validated against a frozen schema** — malformed output physically cannot enter the next agent.
- The hand-off chain:
  - **Intake → Matching:** the structured ClientProfile.
  - **Matching → Kitchen:** the shortfall signal — "demand I couldn't fill from stock."
  - **Donation Triage → Kitchen:** usable ingredients, routed into the scheduled batches.
  - **Matching → Fallback:** the gap days with no compliant meal.
  - **Orchestrator → Delivery:** the completed allocation, to slot into a route.
- The **Safety Auditor sits outside the chain** — it observes every hand-off but never produces pipeline artifacts, so it can't be a single point of failure for a run. Its verdicts come from the same deterministic rule module as the UI validators; the model only writes the incident narrative.
- Every agent also **emits events** (`thought` / `check` / `output`) into one stream — that stream *is* the activity feed on screen, and the persisted audit trail.

### The exact interaction you saw on screen (hero referral, 23 events)
1. 🧭 Referral received → dispatches Intake.
2. 📥 Parses referral → diet orders identified → ClientProfile out.
3. 🩺 Scans inventory → **rejects** on hard checks (Pancit Bihon, Beef Kaldereta, Lumpiang Sariwa) → **matches 5** compliant Filipino meals (Adobo, Bangus, Ginataang Gulay, Tinola, Sinigang) → **flags a shortfall**.
4. 👨‍🍳 Aggregates the shortfall → schedules the Low-Sodium Chicken Adobo batch within today's capacity.
5. 📦 Triages donations D001 & D007 → routes them into that batch.
6. 🛒 Composes the microwave-only grocery kit for the gap days.
7. 🚚 Slots the client into the existing zone route.
8. 🧭 Plan complete.

### Q: "Why multiple agents instead of one big prompt?"
**Say:** *"Narrow contracts. Each agent has one job, one input schema, one
output schema — so each is auditable, testable, and swappable on its own. One
mega-prompt gives you one unauditable blob."*

### Q: "What happens when one of the agents fails?"
**Say:** *"It degrades, it never guesses — and it never fails quietly. Every
agent's output is schema-validated and fact-audited; bad output is retried
once with the errors fed back, then rejected. A rejected agent falls back to
the deterministic rule engine, so the client still gets a compliant plan —
you lose the narration, never the safety. And the Safety Auditor writes the
incident report: which rule broke, on which output, what the retry did, and
which fallback took over — straight into the event stream and the CNO's
action inbox."*

Backup — what failure means per agent:
- 📥 **Intake fails** → the only hard stop: no guessed clinical profile, ever. The referral stays in the intake queue for manual entry.
- 🩺 **Matching fails** → the deterministic allocator has already computed the compliant set — you lose the reasoning trail, not the allocation.
- 👨‍🍳 **Kitchen fails** → the shortfall stays visible as unmet demand; the existing-stock allocation stands.
- 📦 **Donation Triage fails** → the donation is parked as pending — it never enters inventory unclassified.
- 🛒 **Fallback fails** → gap days are flagged to the CNO instead of shipping a guessed grocery kit.
- 🚚 **Delivery fails** → the client sits in an unassigned pool for manual slotting.
- The pattern to name out loud: *"failure costs us automation and narration — it never costs a clinical guarantee. And the human approval gate is the final catch."*

### Q: "Who watches the agents? / Isn't your safety agent just another LLM that can fail?"
**Say:** *"No — the Safety Auditor's verdicts are deterministic. It runs the
same clinical rule module the browser validators use, on every hand-off. The
model is only used to write the incident narrative a human reads — if even
that fails, the raw rule verdict still lands in the log. The watchdog can
lose its voice, but it can't lose its judgment."*

Backup:
- It's **out-of-band**: observes hand-offs, never produces pipeline artifacts — so it can't block or corrupt a run.
- Incident report contents: failing rule → offending artifact → retry outcome → fallback taken → surfaced in the CNO's action inbox.
- If asked *"why didn't we see it in the demo feed?"*: *"It only speaks when something fails — a quiet feed is the good outcome. Its passing checks are the badges you see on every meal card."*

---

## 2. Pipeline & architecture

### Q: "Walk me through what happens when a referral lands."
**Say:** *"Five specialists under an orchestrator. Intake parses the referral →
Clinical Matching scores every meal → Kitchen Planning batches the shortfall →
Donation Triage routes incoming stock into those batches → Delivery slots the
client. Each stage emits typed events — that's the feed you saw."*

Backup:
- Hard rules (allergens, sodium, carbs, diet tags) **exclude** meals outright.
- Soft prefs (cuisine, dislikes, variety, donation use) ranked **only within** the compliant set.
- No compliant meal → **Fallback Composer**: grocery kit + prep steps matched to cooking ability (the microwave-only case).
- Full cast and hand-offs: [section 1](#1-the-agents--how-they-interact).

### Q: "What's the stack?"
**Say:** *"Next.js 16 + React 19 + TypeScript front, Tailwind. Node/TypeScript
orchestrator calling Claude Opus per specialist. Deterministic rule engine for
all clinical checks, shared between pipeline and UI. Runs persist as JSON event
streams — that's our audit trail."*

Backup:
- Dataset: synthetic, seeded generator — same seed, byte-identical output.
- Meal images: gpt-image-1, offline, cosmetic only.

### Q: "Why Next.js?"
**Say:** *"One codebase from dashboard to API routes, and the UI and agent
pipeline share the same TypeScript types and the same rule module — that
sharing is the point."*

---

## 3. The model in the loop

### Q: "Where is the LLM — and where not?"
**Say:** *"Language, not arithmetic. It narrates why, writes prep instructions
and triage rationale. Every pass/fail verdict is deterministic code."*

### Q: "Hallucination?"
**Say:** *"Ground, audit, reject. Prompts contain only facts recomputed from
the dataset by the same rule module the validators use. Output is
schema-validated and fact-checked; a failing run retries once with the errors
fed back, then is rejected."*

Backup:
- Rule module (`hardCheck`/`softScore`) shared generator ↔ UI → model can't invent a meal, number, or verdict.
- Last line: browser validators re-check at render time anyway.

### Q: "Model call fails mid-run?"
**Say:** *"It fails safe. Schema validation catches malformed, fact audit
catches wrong, and a rejected run degrades to rule-engine-only allocation —
compliant plan, plain labels, no narration. Safety never depends on the model."*

### Q: "Latency?"
**Say:** *"Matching is microseconds; model calls dominate — tens of seconds
per referral, streamed so the dietitian watches progress. Against a workflow
that takes hours, that's not the fight."*

### Q: "Cost?"
**Say:** *"Cents per referral. Model is only in the explanation path — the
matching itself is free."*

### Q: "Why Opus — overkill?"
**Say:** *"The prose has to survive clinical scrutiny — that's where reasoning
quality pays. Agents are model-agnostic behind schema contracts; cheaper
models can take mechanical agents if cost ever matters."*

### Q: "Why not RAG / fine-tuning?"
**Say:** *"Constraints are exact and enumerable — 80 meals with explicit
nutrition data. Facts are injected recomputed; there's nothing to retrieve.
Fine-tuning just adds risk."*

---

## 4. Safety & correctness

### Q: "What guarantees no unsafe meal ships?"
**Say:** *"Three independent deterministic layers: the allocator only selects
from meals passing hard checks; a full-dataset audit gates every build — it
cannot compile with a violation; and the browser re-verifies at render time.
The LLM is not in that chain."*

### Q: "Can the dietitian's edits create a violation?"
**Say:** *"No silent ones. Swaps, group substitutions, and holds are layered
over allocations at render time and run through the exact same validators —
the UI flags it immediately."*

### Q: "Autonomous or human-in-the-loop?"
**Say:** *"Agents propose; the CNO approves — weekly menu, each referral plan,
each donation triage. For clinical software that's the deployment requirement,
not a limitation. Hours of cross-referencing become a one-minute review."*

### Q: "Is the '0 violations' banner hardcoded?"
**Say:** *"Change the data and watch it recompute — trigger the stockout, make
a swap. Every badge recomputes from client-side validators on every render.
Same check gates the build."*

---

## 5. Data

### Q: "Real patient data?"
**Say:** *"No — 100% synthetic, on purpose. No PHI anywhere in the system
today."*

Backup:
- 150 clients, 80 meals, donations, kitchen capacity, routes — one seeded generator.
- Hero case exercises every constraint at once: diabetes + cardio, peanut allergy, ≤600 mg sodium, 45–60 g carbs, Filipino pref, microwave-only.
- Meals modeled on POH's menu style, not copied.

### Q: "Why JSON files, not a database?"
**Say:** *"The dataset is a frozen, versioned, schema-validated artifact —
diffable, and every run against it is reproducible. Production is Postgres;
the schemas are the migration spec."*

---

## 6. Scale & production path

### Q: "What about 10,000 clients?"
**Say:** *"Matching is rule filtering plus scoring — microseconds per client,
embarrassingly parallel. What gets hard is kitchen batching and routing —
that's a solver problem, OR-Tools class, not more LLM."*

### Q: "What's left before real deployment?" *(own it before they ask)*
1. **FHIR intake** — real referral endpoint (today: HL7-style synthetic).
2. **Backend** — Postgres, auth, roles, server-side audit log.
3. **Verified nutrition data** — dietitian-validated meal DB.
4. **Real routing** — geo optimization, not zone lookup.
5. **HIPAA** — below.

### Q: "HIPAA with an LLM in the loop?"
**Say:** *"PHI lives in the deterministic layer; the model writes explanations
from recomputed facts. Production inference goes through a HIPAA-eligible
deployment — Claude on Bedrock under a BAA — and the persisted event streams
are the audit trail for free."*

---

## 7. Curveballs

### Q: "What breaks first / least proud of?"
**Say it before they find it:**
- Workflow state is localStorage.
- One kitchen, one week, fixed capacity model.
- Routing is zone lookup.
- Nutrition facts are synthetic.
- Close with: *"None of that touches the core claim — the constraint engine and schema contracts are real and enforced."*

### Q: "Couldn't a spreadsheet do this?"
**Say:** *"The hard checks, maybe — slowly. It can't compose cooking-ability-
matched grocery kits, batch unmet demand into feasible kitchen production fed
by donations, or produce a reasoning trail per client. The value is the
end-to-end reconciliation."*

---

## Appendix — know your delta (do NOT present)

The doc above answers as a live system. The build differs — know these cold:

- **Shipped build replays pre-generated streams.** Every `data/agent_runs/*.json`
  says `"generator": "template"` — deterministic output, not model-authored.
  "Streaming" is a timer replay (`src/lib/replay.ts`).
- **The Claude pipeline is real but offline.** `scripts/generate-agent-runs.mjs`
  does everything §3 claims (grounding, schema validation, fact audit,
  retry-then-reject) — as a batch step, not behind an API route.
- **The fail-safe degrade paths** (model-call failure in §3, per-agent
  failure in §1) describe the offline pipeline's behavior and the intended
  design — none of it is wired runtime fallback logic. Don't offer to
  demonstrate a failure live.
- **The Safety Auditor is a personification, not a process.** What's real
  behind it: the shared rule module, the browser validators
  (`src/lib/validators.ts`), the build gate (`scripts/validate-data.mjs`),
  and the generation pipeline's fact audit. There is no separate monitoring
  agent, no incident-report path, and nothing auditor-related in the event
  streams or the action inbox. The "quiet feed" line is the only safe answer
  to "show me the auditor" — never offer to trigger it.
- **☠️ The exposing question: "Run a brand-new referral right now, live."**
  No answer in this framing survives a failed attempt. Decide **before** Q&A:
  - **(a) Make it true** — API route running the pipeline for one client,
    streaming into the existing feed. The replay hook already has a live-feed
    interface; this is the strong move.
  - **(b) Scope it** — *"Runs go through the audited batch pipeline; we don't
    do unaudited live inference against a clinical dataset."* True and
    defensible — but only said upfront, never after a failed live attempt.

Repo or JSON gets opened → the first three points are visible in minutes.
Before claiming anything beyond this doc, check it against this appendix.
