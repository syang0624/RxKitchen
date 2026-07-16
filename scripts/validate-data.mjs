#!/usr/bin/env node
/**
 * NourishOS dataset validator (PRD §11 safety net).
 * Re-verifies every allocation against the hard constraint hierarchy (PRD §5)
 * independently of the generator. Exits non-zero on any clinical violation —
 * run at build time / in CI. The dashboard runs the same checks client-side.
 *
 * Usage: node scripts/validate-data.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA = join(process.cwd(), "data");
const load = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

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

console.log("── NourishOS dataset validation ──");
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
