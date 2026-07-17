#!/usr/bin/env node
/**
 * RxKitchen dataset validator (PRD §11 safety net).
 * Re-verifies every allocation against the hard constraint hierarchy (PRD §5)
 * independently of the generator. Exits non-zero on any clinical violation —
 * run at build time / in CI. The dashboard runs the same checks client-side.
 *
 * Usage: node scripts/validate-data.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const DATA = join(process.cwd(), "data");
const SCHEMAS = join(process.cwd(), "schemas");
const load = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const loadSchema = (f) => JSON.parse(readFileSync(join(SCHEMAS, f), "utf8"));

const clients = load("clients.json");
const meals = load("meals.json");
const inventory = load("inventory.json");
const donations = load("donations.json");
const allocations = load("allocations.json");
const productionPlan = load("production_plan.json");

const clientById = new Map(clients.map((c) => [c.id, c]));
const mealById = new Map(meals.map((m) => [m.id, m]));
const groceryById = new Map(inventory.map((g) => [g.id, g]));

const DIET_TAG_REQUIRED = { diabetic: "diabetic-friendly", cardiovascular: "heart-healthy", renal: "renal-friendly", "low-sodium": "heart-healthy" };

const violations = [];
const flag = (clientId, itemId, rule, detail) => violations.push({ client_id: clientId, item: itemId, rule, detail });

// --- schema conformance (schemas/ is the frozen contract the app builds against) ---
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
ajv.addSchema(loadSchema("defs.schema.json"));
const schemaFor = (name) => ajv.compile(loadSchema(name));

const FILE_SCHEMAS = [
  ["clients.json", "clients.schema.json"],
  ["meals.json", "meals.schema.json"],
  ["inventory.json", "inventory.schema.json"],
  ["donations.json", "donations.schema.json"],
  ["kitchen.json", "kitchen.schema.json"],
  ["delivery.json", "delivery.schema.json"],
  ["allocations.json", "allocations.schema.json"],
  ["production_plan.json", "production_plan.schema.json"],
];
const validators = new Map(FILE_SCHEMAS.map(([data, schema]) => [data, schemaFor(schema)]));
const agentRunValidator = schemaFor("agent_run.schema.json");
const scenarioValidator = schemaFor("scenario.schema.json");

let schemaErrors = 0;
const checkSchema = (label, validate, doc) => {
  if (!validate(doc)) {
    schemaErrors += validate.errors.length;
    for (const e of validate.errors.slice(0, 10)) console.error(`  schema ${label}${e.instancePath}: ${e.message}`);
  }
};
for (const [file, validate] of validators) checkSchema(file, validate, load(file));
for (const f of readdirSync(join(DATA, "agent_runs"))) checkSchema(`agent_runs/${f}`, agentRunValidator, load(`agent_runs/${f}`));
for (const f of readdirSync(join(DATA, "scenarios"))) checkSchema(`scenarios/${f}`, scenarioValidator, load(`scenarios/${f}`));
if (schemaErrors) {
  console.error(`\n${schemaErrors} schema error(s) — the data no longer matches the frozen contract in schemas/`);
  process.exit(1);
}

// --- hard-constraint re-verification (independent of generator logic) ---
for (const alloc of allocations) {
  const client = clientById.get(alloc.client_id);
  if (!client) { flag(alloc.client_id, null, "integrity", "allocation references unknown client"); continue; }

  for (const item of alloc.items) {
    const meal = mealById.get(item.meal_id);
    if (!meal) { flag(client.id, item.meal_id, "integrity", "unknown meal id"); continue; }

    const allergenHits = meal.allergens.filter((a) => client.allergies.includes(a));
    if (allergenHits.length) flag(client.id, meal.id, "allergen", `${meal.name} contains ${allergenHits.join(", ")}`);
    if (meal.sodium_mg > client.max_sodium_mg) flag(client.id, meal.id, "sodium", `${meal.sodium_mg} mg > ${client.max_sodium_mg} mg ceiling`);
    if (meal.carbs_g < client.carb_range_g[0] || meal.carbs_g > client.carb_range_g[1]) flag(client.id, meal.id, "carbs", `${meal.carbs_g} g outside ${client.carb_range_g.join("–")} g`);
    for (const order of client.diet_orders) {
      const tag = DIET_TAG_REQUIRED[order];
      if (tag && !meal.diet_tags.includes(tag)) flag(client.id, meal.id, "diet_order", `'${order}' requires '${tag}' tag on ${meal.name}`);
    }
    if (client.cooking_ability === "none" && meal.reheat_method !== "none") flag(client.id, meal.id, "prep", `client cannot heat food; meal needs ${meal.reheat_method}`);
    if (client.cooking_ability === "microwave" && !["none", "microwave"].includes(meal.reheat_method)) flag(client.id, meal.id, "prep", `client is microwave-only; meal needs ${meal.reheat_method}`);
  }

  if (alloc.grocery_kit) {
    for (const item of alloc.grocery_kit.items) {
      const g = groceryById.get(item.grocery_id);
      if (!g) { flag(client.id, item.grocery_id, "integrity", "unknown grocery id"); continue; }
      const hits = g.allergens.filter((a) => client.allergies.includes(a));
      if (hits.length) flag(client.id, g.id, "allergen", `${g.name} contains ${hits.join(", ")}`);
      if (client.cooking_ability === "none" && g.prep_complexity !== "none") flag(client.id, g.id, "prep", `${g.name} needs ${g.prep_complexity}`);
      if (client.cooking_ability === "microwave" && g.prep_complexity === "stovetop") flag(client.id, g.id, "prep", `${g.name} needs stovetop`);
    }
  }
}

// --- nutrition label consistency: calories must equal the macros (4/4/9) ---
for (const meal of meals) {
  const expected = meal.carbs_g * 4 + meal.protein_g * 4 + meal.fat_g * 9;
  if (meal.calories !== expected) {
    flag(null, meal.id, "nutrition", `${meal.name}: label says ${meal.calories} kcal but macros add to ${expected}`);
  }
}

// --- menu discipline: the kitchen cooks at most 5 distinct recipes per day ---
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
for (const day of DAY_NAMES) {
  const distinct = new Set(
    allocations.flatMap((a) => a.items.filter((i) => i.day === day).map((i) => i.meal_id)),
  );
  if (distinct.size > 5) flag(null, day, "menu", `${distinct.size} distinct meals on ${day}; kitchen max is 5`);
  if (distinct.size > 0 && distinct.size < 3) flag(null, day, "menu", `only ${distinct.size} distinct meal(s) on ${day}; menu min is 3`);
}

// --- stock feasibility: demand must not exceed base stock + scheduled batches ---
const demand = new Map();
for (const alloc of allocations) for (const item of alloc.items) demand.set(item.meal_id, (demand.get(item.meal_id) ?? 0) + item.qty);
const batchQty = new Map();
for (const b of productionPlan.batches) batchQty.set(b.meal_id, (batchQty.get(b.meal_id) ?? 0) + b.qty);
for (const [mealId, qty] of demand) {
  const available = (mealById.get(mealId)?.stock_qty ?? 0) + (batchQty.get(mealId) ?? 0);
  if (qty > available) flag(null, mealId, "stock", `demand ${qty} > available ${available}`);
}

// --- metrics (PRD §9) ---
const matched = allocations.filter((a) => a.fallback_level <= 1 && a.items.length > 0).length;
const covered = allocations.filter((a) => a.items.length > 0 || a.grocery_kit).length;
const donationItems = donations.flatMap((d) => d.items.map(() => d.routed_to));
const utilization = donationItems.filter(Boolean).length / donationItems.length;

console.log("── RxKitchen dataset validation ──");
console.log(`clients: ${clients.length} | meals: ${meals.length} | allocations: ${allocations.length}`);
console.log(`clinical violations: ${violations.length}`);
console.log(`matched to fully compliant meals: ${((matched / allocations.length) * 100).toFixed(1)}% (target ≥90%)`);
console.log(`overall coverage (meals or grocery kit): ${((covered / allocations.length) * 100).toFixed(1)}% (target 100%)`);
console.log(`donation utilization: ${(utilization * 100).toFixed(1)}% (target ~75–80%)`);

if (violations.length) {
  console.error("\nVIOLATIONS FOUND — regenerate the dataset (never hand-edit):");
  for (const v of violations.slice(0, 25)) console.error(`  client ${v.client_id} · ${v.item} · ${v.rule}: ${v.detail}`);
  if (violations.length > 25) console.error(`  …and ${violations.length - 25} more`);
  process.exit(1);
}
console.log("✓ zero clinical violations — dataset is demo-safe");
