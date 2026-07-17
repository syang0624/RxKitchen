"use client";

/**
 * Client plan card (FR3) + grocery-kit fallback view (FR4).
 *
 * Written for a non-technical Chief Nutrition Officer: the weekly schedule
 * leads (meals sorted Mon–Sun), every safety check is spelled out in words,
 * and IDs are secondary details. Every check indicator is recomputed live by
 * the client-side validators from raw meal/client data — the generator's own
 * `constraint_checks` are never trusted or rendered (PRD §6, §11).
 */
import { useMemo, useState } from "react";
import type { AgentEvent, Allocation, ClientProfile } from "@/lib/types";
import { groceryById, mealById } from "@/lib/data";
import {
  checkGroceryForClient,
  checkMealForClient,
  summarizePreferences,
} from "@/lib/validators";
import ExplainDrawer from "./ExplainDrawer";
import { CheckPill, SectionCard } from "./ui";

const FALLBACK_LABEL: Record<number, string> = {
  0: "All meals from current stock",
  1: "Includes a fresh kitchen batch",
  2: "Includes a grocery kit",
};

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const COOKING_LABEL: Record<ClientProfile["cooking_ability"], string> = {
  none: "no cooking — ready-to-eat only",
  microwave: "microwave only",
  stovetop: "stovetop",
  full: "full kitchen",
};

function MealItem({
  item,
  client,
  onExplain,
}: {
  item: Allocation["items"][number];
  client: ClientProfile;
  onExplain: () => void;
}) {
  const meal = mealById.get(item.meal_id);
  if (!meal) {
    return (
      <li className="brutal-box bg-red-500 p-3 text-xs font-bold text-white">
        Unknown meal {item.meal_id} — data problem, tell the data owner.
      </li>
    );
  }
  const verdict = checkMealForClient(meal, client);
  const cuisineMatch = meal.cuisine === client.cuisine_pref;
  return (
    <li
      className={`brutal-box p-3 ${verdict.pass ? "bg-white" : "bg-red-100"}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="brutal-flat mt-0.5 shrink-0 bg-black px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase text-white">
          {item.day}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold">{meal.name}</p>
            {cuisineMatch && (
              <span className="brutal-flat shrink-0 bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                ♥ {client.cuisine_pref} favorite
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-black/60">
            {meal.cuisine}
            {item.qty > 1 ? ` · ${item.qty} servings` : ""}
            {item.from_batch && (
              <span className="brutal-flat ml-1 bg-amber-300 px-1.5 py-px font-bold text-black">
                fresh from today&apos;s kitchen batch
              </span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <CheckPill
              pass={verdict.pass}
              label={
                verdict.pass
                  ? `Safe — all ${verdict.checks.length} checks pass`
                  : `${verdict.checks.filter((c) => !c.pass).length} check${
                      verdict.checks.filter((c) => !c.pass).length > 1 ? "s" : ""
                    } fail`
              }
            />
            {verdict.checks
              .filter((c) => !c.pass)
              .map((c) => (
                <CheckPill key={c.rule} pass={false} label={c.label} />
              ))}
            <button
              onClick={onExplain}
              title="Why this meal? See every safety check and what the agents said."
              className="brutal-btn ml-auto bg-white px-2 py-0.5 text-[10px] font-bold uppercase"
            >
              Why?
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function ClientPlanCard({
  client,
  allocation,
  runEvents,
  revealedMealIds,
  kitRevealed,
}: {
  client: ClientProfile;
  allocation: Allocation | undefined;
  /** This client's pipeline events, for the "why this meal?" drawer (FR11). */
  runEvents: AgentEvent[];
  /** During a hero replay, only meals already matched in the feed; null = show all. */
  revealedMealIds: Set<string> | null;
  kitRevealed: boolean;
}) {
  const [explainItem, setExplainItem] = useState<
    Allocation["items"][number] | null
  >(null);
  const items = useMemo(() => {
    const revealed =
      !allocation
        ? []
        : !revealedMealIds
          ? allocation.items
          : allocation.items.filter((i) => revealedMealIds.has(i.meal_id));
    // Weekly-schedule framing: always present the plan Monday → Sunday.
    return [...revealed].sort(
      (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day),
    );
  }, [allocation, revealedMealIds]);

  const prefs = useMemo(
    () =>
      allocation ? summarizePreferences(allocation, client, mealById) : null,
    [allocation, client],
  );

  const pendingCount = allocation ? allocation.items.length - items.length : 0;
  const showKit = Boolean(allocation?.grocery_kit) && kitRevealed;

  return (
    <SectionCard
      title={`Weekly plan · ${client.name}`}
      subtitle={`#${client.id}`}
    >
      <div className="space-y-4 p-3">
        {/* profile summary */}
        <div className="brutal-box bg-background p-3 text-xs leading-relaxed text-black/80">
          <p className="font-bold text-black">
            {client.referring_hospital} · {client.address_zone} ·{" "}
            {client.meals_per_week} meals per week
          </p>
          <p className="mt-1">
            Diet:{" "}
            <span className="font-bold text-black">
              {client.diet_orders.join(" + ") || "no restrictions"}
            </span>{" "}
            · limits per meal: sodium ≤{" "}
            <span className="font-bold text-black">{client.max_sodium_mg} mg</span>,
            carbs{" "}
            <span className="font-bold text-black">
              {client.carb_range_g[0]}–{client.carb_range_g[1]} g
            </span>
          </p>
          <p className="mt-1.5 flex flex-wrap gap-1">
            {client.allergies.map((a) => (
              <span
                key={a}
                className="brutal-flat bg-red-400 px-1.5 py-px font-bold text-black"
              >
                ⚠ {a} allergy
              </span>
            ))}
            <span className="brutal-flat bg-white px-1.5 py-px">
              prefers {client.cuisine_pref} food
            </span>
            {client.dislikes.map((d) => (
              <span key={d} className="brutal-flat bg-white px-1.5 py-px">
                dislikes {d}
              </span>
            ))}
            <span className="brutal-flat bg-white px-1.5 py-px">
              {COOKING_LABEL[client.cooking_ability]}
            </span>
          </p>
        </div>

        {!allocation ? (
          <p className="px-1 text-sm text-black/60">
            No plan yet — pick this referral in the intake queue to start.
          </p>
        ) : (
          <>
            {/* preference badges (FR3) */}
            {prefs && !revealedMealIds && (
              <div className="flex flex-wrap gap-1.5 px-1">
                <span className="brutal-flat bg-white px-2 py-0.5 text-[11px] font-bold">
                  {FALLBACK_LABEL[allocation.fallback_level]}
                </span>
                {prefs.totalMeals > 0 && prefs.cuisineMatches > 0 && (
                  <span className="brutal-flat bg-primary px-2 py-0.5 text-[11px] font-bold text-white">
                    {prefs.cuisineMatches} of {prefs.totalMeals} meals match
                    their favorite cuisine
                  </span>
                )}
                {!prefs.dislikesAvoided && (
                  <span className="brutal-flat bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                    contains a disliked food: {prefs.dislikeHits.join("; ")}
                  </span>
                )}
              </div>
            )}

            {/* the weekly meal schedule (Mon–Sun) */}
            {items.length > 0 && (
              <ul className="space-y-2">
                {items.map((item) => (
                  <MealItem
                    key={`${item.meal_id}-${item.day}`}
                    item={item}
                    client={client}
                    onExplain={() => setExplainItem(item)}
                  />
                ))}
              </ul>
            )}
            {pendingCount > 0 && (
              <p className="flex items-center gap-2 px-1 text-xs text-black/60">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full border border-black bg-secondary" />
                matching in progress — {pendingCount} day
                {pendingCount > 1 ? "s" : ""} still to fill…
              </p>
            )}

            {/* grocery-kit fallback (FR4) */}
            {showKit && allocation.grocery_kit && (
              <div className="brutal-box bg-rose-100 p-3">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  🧺 Grocery kit — covers the other{" "}
                  {allocation.grocery_kit.covers_days} day
                  {allocation.grocery_kit.covers_days > 1 ? "s" : ""}
                  {allocation.grocery_kit.items.every((ki) => {
                    const g = groceryById.get(ki.grocery_id);
                    return g ? checkGroceryForClient(g, client).pass : false;
                  }) && (
                    <CheckPill pass label="all items safe" />
                  )}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {allocation.grocery_kit.items.map((ki) => {
                    const g = groceryById.get(ki.grocery_id);
                    const verdict = g ? checkGroceryForClient(g, client) : null;
                    return (
                      <li
                        key={ki.grocery_id}
                        className="flex flex-wrap items-center gap-1.5 text-xs"
                      >
                        <span className="font-medium">
                          {ki.name} × {ki.qty}
                        </span>
                        {verdict?.checks
                          .filter((c) => !c.pass)
                          .map((c) => (
                            <CheckPill key={c.rule} pass={false} label={c.label} />
                          ))}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 font-heading text-[10px] font-extrabold uppercase tracking-wide">
                  How to prepare ({COOKING_LABEL[client.cooking_ability]})
                </p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-black/80">
                  {allocation.grocery_kit.prep_instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>

      {/* "Explain this decision" drawer (FR11) */}
      {explainItem && (
        <ExplainDrawer
          item={explainItem}
          client={client}
          runEvents={runEvents}
          onClose={() => setExplainItem(null)}
        />
      )}
    </SectionCard>
  );
}
