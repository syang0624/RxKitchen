"use client";

/**
 * Client plan card (FR3) + grocery-kit fallback view (FR4).
 *
 * Every check indicator on this card is recomputed live by the client-side
 * validators from raw meal/client data — the generator's own
 * `constraint_checks` are never trusted or rendered (PRD §6, §11).
 */
import { useMemo } from "react";
import type { Allocation, ClientProfile, DeliveryRoute } from "@/lib/types";
import { groceryById, mealById } from "@/lib/data";
import {
  checkGroceryForClient,
  checkMealForClient,
  summarizePreferences,
} from "@/lib/validators";
import { CheckPill, SectionCard } from "./ui";

const FALLBACK_LABEL: Record<number, string> = {
  0: "Level 0 · existing meals",
  1: "Level 1 · includes fresh kitchen batch",
  2: "Level 2 · grocery kit",
};

function MealItem({
  item,
  client,
}: {
  item: Allocation["items"][number];
  client: ClientProfile;
}) {
  const meal = mealById.get(item.meal_id);
  if (!meal) {
    return (
      <li className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
        Unknown meal {item.meal_id} — data integrity failure, report to data owner.
      </li>
    );
  }
  const verdict = checkMealForClient(meal, client);
  const cuisineMatch = meal.cuisine === client.cuisine_pref;
  return (
    <li
      className={`rounded-lg border p-3 ${
        verdict.pass
          ? "border-zinc-800 bg-zinc-950/50"
          : "border-red-500/50 bg-red-500/10"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-100">{meal.name}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {item.day} · qty {item.qty} · {meal.cuisine}
            {item.from_batch && (
              <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-px font-medium text-amber-300">
                fresh from batch {item.from_batch}
              </span>
            )}
          </p>
        </div>
        {cuisineMatch && (
          <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300">
            ♥ {client.cuisine_pref}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {verdict.checks.map((c) => (
          <CheckPill key={c.rule} pass={c.pass} label={c.label} />
        ))}
      </div>
    </li>
  );
}

export default function ClientPlanCard({
  client,
  allocation,
  route,
  revealedMealIds,
  kitRevealed,
  routeRevealed,
}: {
  client: ClientProfile;
  allocation: Allocation | undefined;
  route: DeliveryRoute | undefined;
  /** During a hero replay, only meals already matched in the feed; null = show all. */
  revealedMealIds: Set<string> | null;
  kitRevealed: boolean;
  routeRevealed: boolean;
}) {
  const items = useMemo(() => {
    if (!allocation) return [];
    if (!revealedMealIds) return allocation.items;
    return allocation.items.filter((i) => revealedMealIds.has(i.meal_id));
  }, [allocation, revealedMealIds]);

  const prefs = useMemo(
    () =>
      allocation ? summarizePreferences(allocation, client, mealById) : null,
    [allocation, client],
  );

  const pendingCount = allocation ? allocation.items.length - items.length : 0;
  const showKit = Boolean(allocation?.grocery_kit) && kitRevealed;
  const showRoute = Boolean(route) && routeRevealed;

  return (
    <SectionCard
      title={`Client plan · ${client.name}`}
      subtitle={`#${client.id}`}
    >
      <div className="space-y-4 p-3">
        {/* profile summary */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs leading-relaxed text-zinc-400">
          <p>
            <span className="text-zinc-200">{client.referring_hospital}</span>{" "}
            · {client.address_zone} · {client.meals_per_week} meals/week
          </p>
          <p className="mt-1">
            Diet: <span className="text-zinc-300">{client.diet_orders.join(" + ") || "none"}</span>{" "}
            · Sodium ≤ <span className="text-zinc-300">{client.max_sodium_mg} mg</span>{" "}
            · Carbs <span className="text-zinc-300">{client.carb_range_g[0]}–{client.carb_range_g[1]} g</span>
          </p>
          <p className="mt-1 flex flex-wrap gap-1">
            {client.allergies.map((a) => (
              <span key={a} className="rounded bg-red-500/10 px-1.5 py-px text-red-300">
                ⚠ allergy: {a}
              </span>
            ))}
            <span className="rounded bg-zinc-800 px-1.5 py-px">
              prefers {client.cuisine_pref}
            </span>
            {client.dislikes.map((d) => (
              <span key={d} className="rounded bg-zinc-800 px-1.5 py-px">
                dislikes {d}
              </span>
            ))}
            <span className="rounded bg-zinc-800 px-1.5 py-px">
              cooking: {client.cooking_ability}
            </span>
          </p>
        </div>

        {!allocation ? (
          <p className="px-1 text-sm text-zinc-500">
            No allocation yet — run the pipeline from the intake queue.
          </p>
        ) : (
          <>
            {/* preference badges (FR3) */}
            {prefs && !revealedMealIds && (
              <div className="flex flex-wrap gap-1.5 px-1">
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                  {FALLBACK_LABEL[allocation.fallback_level]}
                </span>
                {prefs.totalMeals > 0 && (
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-300">
                    {prefs.cuisineMatches}/{prefs.totalMeals} cuisine matches
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    prefs.dislikesAvoided
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "bg-red-500/15 text-red-300"
                  }`}
                >
                  {prefs.dislikesAvoided
                    ? "✓ dislikes avoided"
                    : `dislike hit: ${prefs.dislikeHits.join("; ")}`}
                </span>
              </div>
            )}

            {/* matched meals */}
            {items.length > 0 && (
              <ul className="space-y-2">
                {items.map((item) => (
                  <MealItem
                    key={`${item.meal_id}-${item.day}`}
                    item={item}
                    client={client}
                  />
                ))}
              </ul>
            )}
            {pendingCount > 0 && (
              <p className="flex items-center gap-2 px-1 text-xs text-zinc-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                matching in progress — {pendingCount} slot
                {pendingCount > 1 ? "s" : ""} remaining…
              </p>
            )}

            {/* grocery-kit fallback (FR4) */}
            {showKit && allocation.grocery_kit && (
              <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3">
                <p className="text-sm font-medium text-rose-200">
                  🧺 Grocery kit · covers {allocation.grocery_kit.covers_days}{" "}
                  day{allocation.grocery_kit.covers_days > 1 ? "s" : ""}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {allocation.grocery_kit.items.map((ki) => {
                    const g = groceryById.get(ki.grocery_id);
                    const verdict = g ? checkGroceryForClient(g, client) : null;
                    return (
                      <li
                        key={ki.grocery_id}
                        className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-300"
                      >
                        <span>
                          {ki.name} × {ki.qty}
                        </span>
                        {verdict?.checks.map((c) => (
                          <CheckPill key={c.rule} pass={c.pass} label={c.label} />
                        ))}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Prep instructions ({client.cooking_ability}-safe)
                </p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-zinc-400">
                  {allocation.grocery_kit.prep_instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* delivery slot */}
            {showRoute && route && (
              <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-3 text-xs text-zinc-300">
                <p className="text-sm font-medium text-blue-200">🚚 Delivery</p>
                <p className="mt-1">
                  Route <span className="font-mono">{route.route_id}</span> ·{" "}
                  {route.zone} · {route.delivery_date} · window {route.window}{" "}
                  {route.cold_chain_ok ? (
                    <span className="text-emerald-300">· cold chain ✓</span>
                  ) : (
                    <span className="text-red-300">· cold chain ✕</span>
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}
