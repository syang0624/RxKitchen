"use client";

/**
 * The holistic view — and the landing screen. The CNO doesn't ask the kitchen
 * to cook one client's plate at a time; she hands them the week: every meal,
 * aggregated across all 150 clients, day by day. Computed live from the same
 * allocations the validators re-check, so the totals stay honest.
 */
import { useMemo } from "react";
import { CookingPot } from "lucide-react";
import type { Allocation } from "@/lib/types";
import { mealById, productionPlan } from "@/lib/data";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABEL: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

export default function WeeklyCookList({
  effectiveAllocations,
}: {
  effectiveAllocations: Allocation[];
}) {
  const week = useMemo(() => {
    const byDay = new Map<string, Map<string, number>>(
      DAYS.map((d) => [d, new Map()]),
    );
    let totalServings = 0;
    let kitClients = 0;
    let kitDays = 0;
    for (const a of effectiveAllocations) {
      for (const it of a.items) {
        const dayMap = byDay.get(it.day);
        if (!dayMap) continue;
        dayMap.set(it.meal_id, (dayMap.get(it.meal_id) ?? 0) + it.qty);
        totalServings += it.qty;
      }
      if (a.grocery_kit) {
        kitClients += 1;
        kitDays += a.grocery_kit.covers_days;
      }
    }
    const recipeIds = new Set([...byDay.values()].flatMap((m) => [...m.keys()]));
    return { byDay, totalServings, kitClients, kitDays, recipes: recipeIds.size };
  }, [effectiveAllocations]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* the week at a glance */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[#dadad3] bg-white px-4 py-3 text-sm sm:px-5">
        <span className="flex items-center gap-2 font-semibold text-[#211922]">
          <CookingPot size={17} aria-hidden />
          What the kitchen cooks this week
        </span>
        <span className="text-[#62625b]">
          <span className="font-mono font-bold text-[#211922]">
            {week.totalServings.toLocaleString()}
          </span>{" "}
          servings · {week.recipes} recipes · {effectiveAllocations.length}{" "}
          clients
          {week.kitClients > 0 && (
            <>
              {" "}
              · plus {week.kitClients} grocery kit
              {week.kitClients > 1 ? "s" : ""} covering {week.kitDays} days
            </>
          )}
        </span>
        <span className="ml-auto flex flex-wrap gap-1.5">
          {productionPlan.batches.map((b) => (
            <span
              key={b.id}
              title={`Fresh batch ${b.id}: ${b.meal_name} — ${b.qty} servings, cooks on ${b.date}`}
              className="rounded-full border border-[#e5e5e0] bg-[#fdf3e2] px-2.5 py-1 text-[11px] font-semibold text-[#211922]"
            >
              Fresh batch · {b.meal_name} × {b.qty}
            </span>
          ))}
        </span>
      </div>

      {/* Monday → Sunday cook list */}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {DAYS.map((day) => {
          const dayMap = week.byDay.get(day)!;
          const rows = [...dayMap.entries()]
            .map(([mealId, servings]) => ({
              meal: mealById.get(mealId),
              servings,
            }))
            .sort((a, b) => b.servings - a.servings);
          const dayTotal = rows.reduce((sum, r) => sum + r.servings, 0);
          return (
            <section
              key={day}
              className="flex min-h-0 max-h-[60vh] flex-col overflow-hidden rounded-2xl border border-[#dadad3] bg-white xl:max-h-none"
            >
              <header className="flex items-baseline justify-between border-b border-[#e5e5e0] bg-[#fbfbf9] px-3 py-2">
                <h3 className="text-xs font-semibold text-[#211922]">
                  {DAY_LABEL[day]}
                </h3>
                <span
                  className="font-mono text-[10px] text-[#62625b]"
                  title={`${dayTotal} servings on ${DAY_LABEL[day]}`}
                >
                  {dayTotal}
                </span>
              </header>
              <ul className="min-h-0 flex-1 divide-y divide-[#f0f0ec] overflow-y-auto">
                {rows.map(({ meal, servings }) => (
                  <li
                    key={meal?.id ?? "?"}
                    className="flex items-start gap-1.5 px-3 py-1.5 text-[11px] leading-tight text-[#211922]"
                    title={
                      meal
                        ? `${meal.name} — ${servings} servings (${meal.cuisine})`
                        : undefined
                    }
                  >
                    <span className="shrink-0 rounded-full bg-secondary px-1.5 font-mono text-[10px] font-bold">
                      {servings}×
                    </span>
                    <span className="min-w-0 font-medium">
                      {meal?.name ?? "?"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
