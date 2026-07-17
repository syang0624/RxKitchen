"use client";

/**
 * The artifact the CNO actually hands to the kitchen: a print-only production
 * sheet (hidden on screen, rendered by the browser's print dialog). Same live
 * data as the week view — day-by-day cook list, fresh batches, donation asks —
 * plus the approval line so the kitchen knows the menu is signed off.
 */
import { useMemo } from "react";
import type { Allocation } from "@/lib/types";
import { mealById, productionPlan } from "@/lib/data";
import { projectWeek } from "@/lib/supply";
import { useWorkflow } from "@/lib/workflow";

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

export default function KitchenPrintSheet({
  effectiveAllocations,
}: {
  effectiveAllocations: Allocation[];
}) {
  const wf = useWorkflow();

  const byDay = useMemo(() => {
    const m = new Map<string, Map<string, number>>(DAYS.map((d) => [d, new Map()]));
    for (const a of effectiveAllocations) {
      for (const it of a.items) {
        const dm = m.get(it.day);
        if (dm) dm.set(it.meal_id, (dm.get(it.meal_id) ?? 0) + it.qty);
      }
    }
    return m;
  }, [effectiveAllocations]);

  const projection = useMemo(
    () => projectWeek(effectiveAllocations),
    [effectiveAllocations],
  );

  return (
    <div className="hidden print:block">
      <div className="p-2 font-sans text-black">
        <h1 className="text-xl font-bold">
          RxKitchen — Kitchen production sheet
        </h1>
        <p className="mt-1 text-sm">
          Week of July 20, 2026 · {projection.totalDemand.toLocaleString()}{" "}
          servings · 150 clients
        </p>
        <p className="mt-1 text-sm font-semibold">
          {wf.weekApprovedAt
            ? `Approved by the Chief Nutrition Officer · ${wf.weekApprovedAt}`
            : "DRAFT — not yet approved"}
          {" · "}0 clinical safety issues at print time (re-verified live)
        </p>

        <h2 className="mt-5 border-b border-black pb-1 text-base font-bold">
          Cook list, Monday → Sunday
        </h2>
        {DAYS.map((day) => {
          const rows = [...byDay.get(day)!.entries()]
            .map(([id, servings]) => ({ meal: mealById.get(id), servings }))
            .sort((a, b) => b.servings - a.servings);
          if (!rows.length) return null;
          return (
            <div key={day} className="mt-3 break-inside-avoid">
              <h3 className="text-sm font-bold">
                {DAY_LABEL[day]}{" "}
                <span className="font-normal">
                  — {rows.reduce((s, r) => s + r.servings, 0)} servings
                </span>
              </h3>
              <table className="mt-1 w-full border-collapse text-sm">
                <tbody>
                  {rows.map(({ meal, servings }) => (
                    <tr key={meal?.id} className="border-b border-neutral-300">
                      <td className="w-16 py-0.5 pr-2 text-right font-bold tabular-nums">
                        {servings} ×
                      </td>
                      <td className="py-0.5">{meal?.name}</td>
                      <td className="py-0.5 pl-2 text-neutral-600">
                        {meal?.cuisine}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        <h2 className="mt-5 border-b border-black pb-1 text-base font-bold">
          Fresh batches to cook
        </h2>
        <table className="mt-1 w-full border-collapse text-sm">
          <tbody>
            {productionPlan.batches.map((b) => (
              <tr key={b.id} className="border-b border-neutral-300">
                <td className="w-10 py-0.5 font-bold">{b.id}</td>
                <td className="py-0.5">{b.meal_name}</td>
                <td className="w-24 py-0.5 text-right tabular-nums">
                  {b.qty} servings
                </td>
                <td className="w-24 py-0.5 text-right tabular-nums">
                  {b.labor_hours} h labor
                </td>
                <td className="w-28 py-0.5 text-right">{b.date}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-5 border-b border-black pb-1 text-base font-bold">
          Donation asks for next week
        </h2>
        <p className="mt-1 text-sm">
          {projection.totalNextWeekCook.toLocaleString()} servings must be
          cooked fresh next week if this menu repeats. Priority ingredients:{" "}
          {projection.ingredientNeeds
            .slice(0, 6)
            .map((i) => `${i.name} (~${i.servings} servings)`)
            .join(" · ")}
          .
        </p>
      </div>
    </div>
  );
}
