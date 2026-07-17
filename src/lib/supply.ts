/**
 * Supply-side math for the holistic view: donation → recipe routing, pantry
 * stock, and the next-week projection. Everything is computed live from the
 * same artifacts the validators re-check — no hardcoded numbers.
 */
import type { Allocation, Donation, Meal, ProductionBatch } from "./types";
import { donations, inventory, mealById, productionPlan } from "./data";

export interface DonationRoute {
  donation: Donation;
  /** Set when the donation feeds a scheduled kitchen batch. */
  batch: ProductionBatch | null;
  accepted: boolean;
}

/** Every donation with where it went: a batch, the pantry, or rejected. */
export function donationRoutes(): DonationRoute[] {
  return donations.map((d) => ({
    donation: d,
    batch: d.routed_to?.startsWith("batch:")
      ? (productionPlan.batches.find(
          (b) => b.id === d.routed_to!.slice("batch:".length),
        ) ?? null)
      : null,
    accepted: d.triage_status !== "non_compliant",
  }));
}

export interface RecipeProjection {
  meal: Meal;
  /** Servings this week's plans need. */
  demand: number;
  /** Covered by current stock. */
  fromStock: number;
  /** Covered by scheduled fresh batches. */
  fromBatch: number;
  /** Stock left over once this week is served. */
  stockAfter: number;
  /** Servings the kitchen must cook next week if this menu repeats. */
  nextWeekCook: number;
}

export interface WeekProjection {
  rows: RecipeProjection[];
  totalDemand: number;
  totalNextWeekCook: number;
  /** Ingredient → servings-worth needed next week, largest first. */
  ingredientNeeds: { name: string; servings: number }[];
  /** Batches with at least one donated ingredient vs. all scheduled batches. */
  batchesFedByDonations: number;
  totalBatches: number;
}

export function projectWeek(effectiveAllocations: Allocation[]): WeekProjection {
  const demand = new Map<string, number>();
  for (const a of effectiveAllocations) {
    for (const it of a.items) {
      demand.set(it.meal_id, (demand.get(it.meal_id) ?? 0) + it.qty);
    }
  }

  const rows: RecipeProjection[] = [...demand.entries()]
    .map(([mealId, d]) => {
      const meal = mealById.get(mealId)!;
      const fromStock = Math.min(meal.stock_qty, d);
      const stockAfter = Math.max(0, meal.stock_qty - d);
      return {
        meal,
        demand: d,
        fromStock,
        fromBatch: d - fromStock,
        stockAfter,
        // If the same menu runs next week, whatever stock survives this week
        // offsets it; the rest must be cooked fresh.
        nextWeekCook: Math.max(0, d - stockAfter),
      };
    })
    .sort((a, b) => b.nextWeekCook - a.nextWeekCook);

  const ingredientTotals = new Map<string, number>();
  for (const r of rows) {
    if (r.nextWeekCook === 0) continue;
    for (const ing of r.meal.key_ingredients) {
      ingredientTotals.set(ing, (ingredientTotals.get(ing) ?? 0) + r.nextWeekCook);
    }
  }
  const ingredientNeeds = [...ingredientTotals.entries()]
    .map(([name, servings]) => ({ name, servings }))
    .sort((a, b) => b.servings - a.servings);

  return {
    rows,
    totalDemand: rows.reduce((s, r) => s + r.demand, 0),
    totalNextWeekCook: rows.reduce((s, r) => s + r.nextWeekCook, 0),
    ingredientNeeds,
    batchesFedByDonations: productionPlan.batches.filter(
      (b) => b.ingredients_from.length > 0,
    ).length,
    totalBatches: productionPlan.batches.length,
  };
}

export interface PantrySummary {
  totalUnits: number;
  itemCount: number;
  /** Lowest-stock items first — the restock watchlist. */
  lowest: { name: string; stock: number }[];
}

export function pantrySummary(): PantrySummary {
  const sorted = [...inventory].sort((a, b) => a.stock_qty - b.stock_qty);
  return {
    totalUnits: inventory.reduce((s, g) => s + g.stock_qty, 0),
    itemCount: inventory.length,
    lowest: sorted.slice(0, 5).map((g) => ({ name: g.name, stock: g.stock_qty })),
  };
}
