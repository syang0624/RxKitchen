/**
 * Client-side constraint validators (PRD §6, §9 — FR6).
 *
 * Every allocation is RE-VERIFIED here in the browser against the hard
 * constraint hierarchy (PRD §5): allergens, sodium ceiling, carb range,
 * diet-order tags, cooking ability. The metrics banner and every per-meal
 * check indicator are computed from these functions — never from the
 * generator's own `constraint_checks`, and never hardcoded.
 *
 * Mirrors scripts/validate-data.mjs (the build-time safety net) exactly.
 */
import type {
  Allocation,
  ClientProfile,
  Donation,
  GroceryItem,
  Meal,
} from "./types";

/** Diet order → meal tag it requires (same table as validate-data.mjs). */
export const DIET_TAG_REQUIRED: Record<string, string> = {
  diabetic: "diabetic-friendly",
  cardiovascular: "heart-healthy",
  renal: "renal-friendly",
  "low-sodium": "heart-healthy",
};

export interface CheckResult {
  rule: "allergen" | "sodium" | "carbs" | "diet_order" | "prep";
  pass: boolean;
  /** Short UI label, e.g. "sodium 426/600 mg". */
  label: string;
  detail: string;
}

export interface MealVerdict {
  pass: boolean;
  checks: CheckResult[];
}

/** Re-check one meal against one client's hard constraints. */
export function checkMealForClient(meal: Meal, client: ClientProfile): MealVerdict {
  const checks: CheckResult[] = [];

  const allergenHits = meal.allergens.filter((a) => client.allergies.includes(a));
  checks.push({
    rule: "allergen",
    pass: allergenHits.length === 0,
    label:
      client.allergies.length === 0
        ? "no allergies on file"
        : allergenHits.length === 0
          ? `safe: no ${client.allergies.join(" or ")}`
          : `contains ${allergenHits.join(", ")}`,
    detail:
      allergenHits.length === 0
        ? `Client allergies (${client.allergies.join(", ") || "none"}) not present in meal allergens (${meal.allergens.join(", ") || "none"}).`
        : `VIOLATION: meal contains ${allergenHits.join(", ")}.`,
  });

  const sodiumPass = meal.sodium_mg <= client.max_sodium_mg;
  checks.push({
    rule: "sodium",
    pass: sodiumPass,
    label: `sodium ${meal.sodium_mg} of ${client.max_sodium_mg} mg`,
    detail: sodiumPass
      ? `${meal.sodium_mg} mg is within the ${client.max_sodium_mg} mg/meal ceiling.`
      : `VIOLATION: ${meal.sodium_mg} mg exceeds the ${client.max_sodium_mg} mg ceiling.`,
  });

  const [carbLo, carbHi] = client.carb_range_g;
  const carbsPass = meal.carbs_g >= carbLo && meal.carbs_g <= carbHi;
  checks.push({
    rule: "carbs",
    pass: carbsPass,
    label: `carbs ${meal.carbs_g} g (target ${carbLo}–${carbHi})`,
    detail: carbsPass
      ? `${meal.carbs_g} g is inside the ${carbLo}–${carbHi} g/meal range.`
      : `VIOLATION: ${meal.carbs_g} g is outside ${carbLo}–${carbHi} g.`,
  });

  const missingTags = client.diet_orders
    .map((order) => ({ order, tag: DIET_TAG_REQUIRED[order] }))
    .filter(({ tag }) => tag && !meal.diet_tags.includes(tag));
  checks.push({
    rule: "diet_order",
    pass: missingTags.length === 0,
    label:
      client.diet_orders.length === 0
        ? "no diet orders"
        : missingTags.length === 0
          ? `fits ${client.diet_orders.join(" + ")} diet`
          : `doesn't fit ${missingTags.map((m) => m.order).join(", ")} diet`,
    detail:
      missingTags.length === 0
        ? `Meal tags satisfy diet orders: ${client.diet_orders.join(", ") || "none"}.`
        : `VIOLATION: ${missingTags.map((m) => `'${m.order}' requires '${m.tag}'`).join("; ")}.`,
  });

  const prepPass =
    client.cooking_ability === "none"
      ? meal.reheat_method === "none"
      : client.cooking_ability === "microwave"
        ? meal.reheat_method === "none" || meal.reheat_method === "microwave"
        : true;
  checks.push({
    rule: "prep",
    pass: prepPass,
    label:
      meal.reheat_method === "none"
        ? "ready to eat"
        : prepPass
          ? `${meal.reheat_method}-ready`
          : `needs ${meal.reheat_method}`,
    detail: prepPass
      ? `Reheat method '${meal.reheat_method}' is within the client's cooking ability (${client.cooking_ability}).`
      : `VIOLATION: client is ${client.cooking_ability}-only but meal needs ${meal.reheat_method}.`,
  });

  return { pass: checks.every((c) => c.pass), checks };
}

/** Re-check one grocery item against one client (allergens + prep, as in validate-data.mjs). */
export function checkGroceryForClient(
  item: GroceryItem,
  client: ClientProfile,
): MealVerdict {
  const checks: CheckResult[] = [];

  const hits = item.allergens.filter((a) => client.allergies.includes(a));
  checks.push({
    rule: "allergen",
    pass: hits.length === 0,
    label:
      hits.length === 0
        ? client.allergies.length
          ? `safe: no ${client.allergies.join(" or ")}`
          : "allergen-free"
        : `contains ${hits.join(", ")}`,
    detail:
      hits.length === 0
        ? "No client allergens present."
        : `VIOLATION: contains ${hits.join(", ")}.`,
  });

  const prepPass =
    client.cooking_ability === "none"
      ? item.prep_complexity === "none"
      : client.cooking_ability === "microwave"
        ? item.prep_complexity !== "stovetop"
        : true;
  checks.push({
    rule: "prep",
    pass: prepPass,
    label:
      item.prep_complexity === "none"
        ? "ready to eat"
        : prepPass
          ? `${item.prep_complexity}-ready`
          : `needs ${item.prep_complexity}`,
    detail: prepPass
      ? `Prep complexity '${item.prep_complexity}' fits cooking ability (${client.cooking_ability}).`
      : `VIOLATION: needs ${item.prep_complexity}, client is ${client.cooking_ability}.`,
  });

  return { pass: checks.every((c) => c.pass), checks };
}

export interface Violation {
  client_id: number | null;
  item: string | null;
  rule: string;
  detail: string;
}

/** Soft-preference summary for the plan card badges (FR3). */
export interface PreferenceSummary {
  cuisineMatches: number;
  totalMeals: number;
  dislikesAvoided: boolean;
  dislikeHits: string[];
}

export function summarizePreferences(
  alloc: Allocation,
  client: ClientProfile,
  mealById: Map<string, Meal>,
): PreferenceSummary {
  let cuisineMatches = 0;
  const dislikeHits: string[] = [];
  for (const item of alloc.items) {
    const meal = mealById.get(item.meal_id);
    if (!meal) continue;
    if (meal.cuisine === client.cuisine_pref) cuisineMatches++;
    for (const dislike of client.dislikes) {
      if (
        meal.key_ingredients.includes(dislike) ||
        meal.name.toLowerCase().includes(dislike.toLowerCase())
      ) {
        dislikeHits.push(`${meal.name}: ${dislike}`);
      }
    }
  }
  return {
    cuisineMatches,
    totalMeals: alloc.items.length,
    dislikesAvoided: dislikeHits.length === 0,
    dislikeHits,
  };
}

/** Collect every hard-constraint violation in one allocation. */
export function validateAllocation(
  alloc: Allocation,
  client: ClientProfile,
  mealById: Map<string, Meal>,
  groceryById: Map<string, GroceryItem>,
): Violation[] {
  const violations: Violation[] = [];

  for (const item of alloc.items) {
    const meal = mealById.get(item.meal_id);
    if (!meal) {
      violations.push({
        client_id: client.id,
        item: item.meal_id,
        rule: "integrity",
        detail: "unknown meal id",
      });
      continue;
    }
    for (const check of checkMealForClient(meal, client).checks) {
      if (!check.pass) {
        violations.push({
          client_id: client.id,
          item: meal.id,
          rule: check.rule,
          detail: check.detail,
        });
      }
    }
  }

  if (alloc.grocery_kit) {
    for (const kitItem of alloc.grocery_kit.items) {
      const g = groceryById.get(kitItem.grocery_id);
      if (!g) {
        violations.push({
          client_id: client.id,
          item: kitItem.grocery_id,
          rule: "integrity",
          detail: "unknown grocery id",
        });
        continue;
      }
      for (const check of checkGroceryForClient(g, client).checks) {
        if (!check.pass) {
          violations.push({
            client_id: client.id,
            item: g.id,
            rule: check.rule,
            detail: check.detail,
          });
        }
      }
    }
  }

  return violations;
}

export interface LiveMetrics {
  clinicalViolations: number;
  violations: Violation[];
  totalClients: number;
  /** % of clients on fully compliant meals (fallback level 0/1) — PRD §9 target ≥90%. */
  fullyCompliantPct: number;
  /** % of clients covered by meals or a grocery kit — target 100%. */
  coveragePct: number;
  /** % of donated line items routed into inventory or batches — target ~75–80%. */
  donationUtilizationPct: number;
  mealsAllocated: number;
}

/**
 * The live metrics banner (FR6). Recomputed with the validators above over
 * the full dataset every time the underlying allocations change (e.g. after
 * a stockout re-plan).
 */
export function computeMetrics(
  allocs: Allocation[],
  clientById: Map<number, ClientProfile>,
  mealById: Map<string, Meal>,
  groceryById: Map<string, GroceryItem>,
  donations: Donation[],
): LiveMetrics {
  const violations: Violation[] = [];
  for (const alloc of allocs) {
    const client = clientById.get(alloc.client_id);
    if (!client) {
      violations.push({
        client_id: alloc.client_id,
        item: null,
        rule: "integrity",
        detail: "allocation references unknown client",
      });
      continue;
    }
    violations.push(...validateAllocation(alloc, client, mealById, groceryById));
  }

  const matched = allocs.filter(
    (a) => a.fallback_level <= 1 && a.items.length > 0,
  ).length;
  const covered = allocs.filter(
    (a) => a.items.length > 0 || a.grocery_kit,
  ).length;

  const donationItems = donations.flatMap((d) => d.items.map(() => d.routed_to));
  const utilization =
    donationItems.length === 0
      ? 0
      : donationItems.filter(Boolean).length / donationItems.length;

  return {
    clinicalViolations: violations.length,
    violations,
    totalClients: allocs.length,
    fullyCompliantPct: allocs.length ? (matched / allocs.length) * 100 : 0,
    coveragePct: allocs.length ? (covered / allocs.length) * 100 : 0,
    donationUtilizationPct: utilization * 100,
    mealsAllocated: allocs.reduce(
      (sum, a) => sum + a.items.reduce((s, i) => s + i.qty, 0),
      0,
    ),
  };
}
