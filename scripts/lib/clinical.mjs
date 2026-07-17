/**
 * Shared clinical-constraint logic (PRD §5 hard/soft hierarchy).
 * Used by the data generator and the agent-run generation pipeline so both
 * reason from identical rules. scripts/validate-data.mjs deliberately does
 * NOT import this — the validator re-implements the checks independently as
 * the safety net (PRD §11).
 */

export const DIET_TAG_REQUIRED = {
  diabetic: "diabetic-friendly",
  cardiovascular: "heart-healthy",
  renal: "renal-friendly",
  "low-sodium": "heart-healthy",
};

export function reheatAllowed(client, meal) {
  const ability = client.cooking_ability;
  if (ability === "none") return meal.reheat_method === "none";
  if (ability === "microwave") return meal.reheat_method === "none" || meal.reheat_method === "microwave";
  return true; // stovetop / full can handle oven & stovetop too
}

/** Returns [] when the meal passes every hard constraint, else human-readable failure reasons. */
export function hardCheck(client, meal) {
  const reasons = [];
  const hit = meal.allergens.filter((a) => client.allergies.includes(a));
  if (hit.length) reasons.push(`allergen: contains ${hit.join(", ")}`);
  if (meal.sodium_mg > client.max_sodium_mg) reasons.push(`sodium: ${meal.sodium_mg} mg exceeds ${client.max_sodium_mg} mg ceiling`);
  if (meal.carbs_g < client.carb_range_g[0] || meal.carbs_g > client.carb_range_g[1]) reasons.push(`carbs: ${meal.carbs_g} g outside ${client.carb_range_g[0]}–${client.carb_range_g[1]} g range`);
  for (const order of client.diet_orders) {
    const tag = DIET_TAG_REQUIRED[order];
    if (tag && !meal.diet_tags.includes(tag)) reasons.push(`diet order '${order}': meal lacks '${tag}' tag`);
  }
  if (!reheatAllowed(client, meal)) reasons.push(`prep: requires ${meal.reheat_method}, client is ${client.cooking_ability}-only`);
  return reasons;
}

/**
 * Donation triage rule (PRD §5 — Donation Triage Agent). Deterministic:
 * `triage_status` and `routed_to` in donations.json are DERIVED from this
 * function (like diet tags from nutrition numbers), so data and rules can
 * never disagree. `batches` is the production plan's batch list.
 *
 * Rules, in order:
 *   1. condition !== "good"            → non_compliant (food-safety intake gate)
 *   2. a scheduled batch lists it as an ingredient → kitchen_ingredient, routed to that batch
 *   3. otherwise                        → usable_as_is, routed to grocery inventory
 */
export function triageDonation(donation, batches) {
  if (donation.condition !== "good") {
    return {
      status: "non_compliant",
      routed_to: null,
      reasons: [`condition '${donation.condition}' fails the food-safety intake gate — only 'good' is accepted`],
    };
  }
  const batch = batches.find((b) => b.ingredients_from.includes(donation.id));
  if (batch) {
    return {
      status: "kitchen_ingredient",
      routed_to: `batch:${batch.id}`,
      reasons: [
        `condition good`,
        `matches an open ingredient need for scheduled batch ${batch.id} (${batch.meal_name}, ${batch.qty} servings on ${batch.date})`,
      ],
    };
  }
  return {
    status: "usable_as_is",
    routed_to: "inventory",
    reasons: ["condition good", "ready to distribute without kitchen prep — shelved as grocery inventory"],
  };
}

/** Soft-preference ranking among meals that already pass every hard check (PRD §5). */
export function softScore(client, meal) {
  let score = 0;
  if (meal.cuisine === client.cuisine_pref) score += 10;
  if (client.dislikes.some((d) => meal.key_ingredients.some((i) => i.includes(d)))) score -= 8;
  score -= meal.sodium_mg / 1000; // gentle bias toward lower sodium
  return score;
}
