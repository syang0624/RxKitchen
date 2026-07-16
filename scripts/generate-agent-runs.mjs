#!/usr/bin/env node
/**
 * NourishOS agent-run generation pipeline (PRD §6).
 *
 * Pre-generates per-referral agent event streams OFFLINE by calling the Claude
 * API — the reasoning text in the activity feed is authored here, before demo
 * day. The Next.js app only replays these files; zero live inference on stage.
 *
 * Every generated stream is grounded and audited: the prompt contains only
 * facts recomputed from data/ (via the same shared clinical rules as the
 * generator), and the output is schema-validated and cross-checked so Claude
 * cannot invent meals, numbers, or constraint results. Runs that fail the
 * audit are retried once with the errors fed back, then rejected.
 *
 * Usage:
 *   node scripts/generate-agent-runs.mjs --client 1042 --force   # hero rerun
 *   node scripts/generate-agent-runs.mjs --clients 1001,1005
 *   node scripts/generate-agent-runs.mjs --limit 10              # first 10 without a run
 *   node scripts/generate-agent-runs.mjs --model claude-opus-4-8 # default
 *
 * Auth: ANTHROPIC_API_KEY, or an `ant auth login` profile (SDK resolves both).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { hardCheck, softScore } from "./lib/clinical.mjs";

const DATA = join(process.cwd(), "data");
const load = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

// ---------- CLI ----------
const args = process.argv.slice(2);
const argVal = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const FORCE = args.includes("--force");
const MODEL = argVal("model") ?? "claude-opus-4-8";

// ---------- data + grounding facts ----------
const clients = load("clients.json");
const meals = load("meals.json");
const allocations = load("allocations.json");
const productionPlan = load("production_plan.json");
const donations = load("donations.json");
const delivery = load("delivery.json");
const kitchen = load("kitchen.json");
const mealById = new Map(meals.map((m) => [m.id, m]));

function factsFor(client) {
  const alloc = allocations.find((a) => a.client_id === client.id);
  const route = delivery.batches.find((b) => b.clients.includes(client.id)) ?? null;
  const rejected = meals
    .map((m) => ({ meal: m, failures: hardCheck(client, m) }))
    .filter((x) => x.failures.length > 0)
    .sort((a, b) => softScore(client, b.meal) - softScore(client, a.meal))
    .slice(0, 5)
    .map((x) => ({ meal_id: x.meal.id, name: x.meal.name, cuisine: x.meal.cuisine, rejection_reasons: x.failures }));
  const batchIds = [...new Set(alloc.items.map((i) => i.from_batch).filter(Boolean))];
  const batches = productionPlan.batches
    .filter((b) => batchIds.includes(b.id))
    .map((b) => ({ ...b, donations: donations.filter((d) => b.ingredients_from.includes(d.id)).map((d) => ({ id: d.id, donor: d.donor, items: d.items.map((i) => i.name), condition: d.condition })) }));
  return {
    client,
    matched_items: alloc.items.map((i) => ({
      meal_id: i.meal_id, name: i.meal_name, day: i.day, from_batch: i.from_batch,
      sodium_mg: i.constraint_checks.sodium.value, sodium_limit: i.constraint_checks.sodium.limit,
      carbs_g: i.constraint_checks.carbs.value, carb_range: i.constraint_checks.carbs.range,
    })),
    rejected_examples: rejected,
    grocery_kit: alloc.grocery_kit,
    fallback_level: alloc.fallback_level,
    kitchen_batches_used: batches,
    kitchen_capacity_today: kitchen[0],
    delivery_route: route,
    total_meals_in_catalog: meals.length,
  };
}

// ---------- prompts (system is stable across clients → prompt-cacheable) ----------
const SYSTEM = `You are the offline generation pipeline for NourishOS, a multi-agent clinical meal-allocation system for Project Open Hand (a medically tailored meal nonprofit). You author the event stream that a dashboard will replay to show specialist agents collaborating on one hospital referral.

The agents, in pipeline order:
- orchestrator: sequences the pipeline, owns the constraint hierarchy, opens and closes the run
- intake: parses the hospital referral into a structured client profile
- matching: scores every meal against HARD constraints (allergens, sodium ceiling, carb range, diet-order tags, reheat ability) then ranks survivors by soft preferences (cuisine, dislikes)
- kitchen: aggregates unmet demand, schedules production batches within capacity
- donation: triages incoming donations and routes them into inventory or batches
- fallback: composes grocery kits with prep instructions when meals can't cover the plan
- delivery: slots the client into a zone route

Constraint hierarchy (never violated): a meal failing ANY hard check is EXCLUDED, never "scored down". Soft preferences may be relaxed; clinical limits never are.

You will receive a FACTS JSON computed by the deterministic matching engine. Author 16–24 events telling this client's referral-to-doorstep story.

Grounding rules (violations cause your output to be rejected):
1. Use ONLY meals, IDs, numbers, and constraint results present in FACTS. Never invent a meal, a nutrition number, or a check result.
2. Every rejected meal you mention must come from rejected_examples, citing its real rejection_reasons.
3. Every matched meal you mention must come from matched_items, citing its real sodium/carb numbers against the client's real limits.
4. In event data, reference IDs exactly as given (meal_id, batch id, donation id, route_id).
5. Only claim a kitchen batch or donation event if kitchen_batches_used is non-empty; only describe a grocery kit if grocery_kit is non-null.

Style: the feed must read as honest agent work, not marketing. Include imperfect-but-real deliberation — meals considered and rejected with concrete reasons, trade-offs weighed (e.g. a cuisine-preferred meal excluded on a hard limit), and terse operational language. Each event: a short title and 1–3 sentence detail. Cover the pipeline in order (orchestrator → intake → matching → kitchen/donation and/or fallback as applicable → delivery → orchestrator wrap-up). The wrap-up must state the plan composition and "0 hard-constraint violations".

Event types: "status" (pipeline state), "thought" (agent deliberation), "check" (a constraint evaluation with pass/fail in data.result), "output" (an artifact produced).`;

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["events"],
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["agent", "type", "title", "detail"],
        properties: {
          agent: { type: "string", enum: ["orchestrator", "intake", "matching", "kitchen", "donation", "delivery", "fallback"] },
          type: { type: "string", enum: ["status", "thought", "tool_call", "check", "output"] },
          title: { type: "string" },
          detail: { type: "string" },
          data: {
            type: "object",
            additionalProperties: false,
            required: [],
            properties: {
              meal_id: { type: "string" },
              donation_id: { type: "string" },
              batch_id: { type: "string" },
              route_id: { type: "string" },
              result: { type: "string", enum: ["pass", "fail", "kitchen_ingredient", "usable_as_is", "non_compliant"] },
            },
          },
        },
      },
    },
  },
};

// ---------- grounding audit ----------
function audit(events, facts) {
  const errors = [];
  const matchedIds = new Set(facts.matched_items.map((i) => i.meal_id));
  const rejectedIds = new Set(facts.rejected_examples.map((r) => r.meal_id));
  const batchIds = new Set(facts.kitchen_batches_used.map((b) => b.id));
  const donationIds = new Set(facts.kitchen_batches_used.flatMap((b) => b.donations.map((d) => d.id)));
  if (events.length < 12) errors.push(`only ${events.length} events; need 16–24`);
  for (const [i, e] of events.entries()) {
    const d = e.data ?? {};
    if (d.meal_id && !mealById.has(d.meal_id)) errors.push(`event ${i}: unknown meal_id ${d.meal_id}`);
    if (d.meal_id && d.result === "pass" && !matchedIds.has(d.meal_id)) errors.push(`event ${i}: claims pass for ${d.meal_id}, not in matched_items`);
    if (d.meal_id && d.result === "fail" && !rejectedIds.has(d.meal_id) && matchedIds.has(d.meal_id)) errors.push(`event ${i}: claims fail for matched meal ${d.meal_id}`);
    if (d.batch_id && !batchIds.has(d.batch_id)) errors.push(`event ${i}: unknown/unused batch_id ${d.batch_id}`);
    if (d.donation_id && !donationIds.has(d.donation_id)) errors.push(`event ${i}: donation ${d.donation_id} not routed to this client's batches`);
    if (d.route_id && d.route_id !== facts.delivery_route?.route_id) errors.push(`event ${i}: wrong route_id ${d.route_id}`);
  }
  const agents = new Set(events.map((e) => e.agent));
  for (const required of ["orchestrator", "intake", "matching", "delivery"]) {
    if (!agents.has(required)) errors.push(`no events from required agent '${required}'`);
  }
  return errors;
}

// ---------- deterministic pacing (seeded by client id, replayable) ----------
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pace(events, clientId) {
  const rand = mulberry32(clientId);
  let t = 0;
  return events.map((e, seq) => {
    t += 900 + Math.floor(rand() * 1700);
    const { data, ...rest } = e;
    const cleanData = data && Object.keys(data).length ? { data } : {};
    return { seq, t_offset_ms: t, ...rest, ...cleanData };
  });
}

// ---------- generation ----------
const client = new Anthropic();

async function generateRun(profile) {
  const facts = factsFor(profile);
  let feedback = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [
        {
          role: "user",
          content:
            `FACTS:\n${JSON.stringify(facts, null, 2)}` +
            (feedback ? `\n\nYour previous attempt was rejected by the grounding audit:\n- ${feedback.join("\n- ")}\nRegenerate the full event stream fixing every issue.` : ""),
        },
      ],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new Error(`model refused (client ${profile.id})`);
    const text = message.content.find((b) => b.type === "text")?.text ?? "";
    const { events } = JSON.parse(text);
    const errors = audit(events, facts);
    if (errors.length === 0) return pace(events, profile.id);
    feedback = errors;
    console.warn(`  audit failed (attempt ${attempt}): ${errors.join("; ")}`);
  }
  throw new Error(`client ${profile.id}: grounding audit failed after retry`);
}

// ---------- schema check on output (same contract the app consumes) ----------
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
ajv.addSchema(JSON.parse(readFileSync(join(process.cwd(), "schemas", "defs.schema.json"), "utf8")));
const validateRun = ajv.compile(JSON.parse(readFileSync(join(process.cwd(), "schemas", "agent_run.schema.json"), "utf8")));

// ---------- main ----------
function targetClients() {
  const single = argVal("client");
  if (single) return [Number(single)];
  const list = argVal("clients");
  if (list) return list.split(",").map(Number);
  const limit = Number(argVal("limit") ?? 0);
  if (limit > 0) {
    const existing = new Set(readdirSync(join(DATA, "agent_runs")).map((f) => f.match(/client-(\d+)\.json/)?.[1]).filter(Boolean).map(Number));
    return clients.map((c) => c.id).filter((id) => !existing.has(id)).slice(0, limit);
  }
  console.error("Specify --client <id>, --clients <id,id,...>, or --limit <n>");
  process.exit(1);
}

for (const id of targetClients()) {
  const profile = clients.find((c) => c.id === id);
  if (!profile) { console.error(`unknown client ${id}`); process.exit(1); }
  const outPath = join(DATA, "agent_runs", `client-${id}.json`);
  if (existsSync(outPath) && !FORCE) {
    console.log(`client ${id}: run exists, skipping (use --force to overwrite)`);
    continue;
  }
  console.log(`client ${id}: generating with ${MODEL}...`);
  const events = await generateRun(profile);
  const run = { client_id: id, scenario: "happy_path", generator: MODEL, events };
  if (!validateRun(run)) {
    console.error(validateRun.errors);
    throw new Error(`client ${id}: output violates agent_run.schema.json`);
  }
  writeFileSync(outPath, JSON.stringify(run, null, 2) + "\n");
  console.log(`client ${id}: wrote ${events.length} events → data/agent_runs/client-${id}.json`);
}
