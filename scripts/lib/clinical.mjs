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

/** Soft-preference ranking among meals that already pass every hard check (PRD §5). */
export function softScore(client, meal) {
  let score = 0;
  if (meal.cuisine === client.cuisine_pref) score += 10;
  if (client.dislikes.some((d) => meal.key_ingredients.some((i) => i.includes(d)))) score -= 8;
  score -= meal.sodium_mg / 1000; // gentle bias toward lower sodium
  return score;
}
