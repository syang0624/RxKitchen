"use client";

/**
 * Kitchen production plan (FR5): batches, quantities, per-day capacity bars,
 * and which donations feed which batch.
 */
import { useMemo } from "react";
import { donationById, kitchen, productionPlan } from "@/lib/data";

export default function KitchenPlan({
  highlightBatchIds,
}: {
  /** Batches to spotlight (e.g. B1 while the hero replay schedules it). */
  highlightBatchIds: Set<string>;
}) {
  const laborByDate = useMemo(() => {
    const used = new Map<string, number>();
    for (const b of productionPlan.batches) {
      used.set(b.date, (used.get(b.date) ?? 0) + b.labor_hours);
    }
    return used;
  }, []);

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        {productionPlan.batches.map((b) => {
          const highlighted = highlightBatchIds.has(b.id);
          return (
            <div
              key={b.id}
              className={`brutal-box p-3 transition-colors ${
                highlighted ? "bg-amber-200" : "bg-white"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-bold">
                  <span className="brutal-flat mr-2 bg-amber-300 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                    {b.id}
                  </span>
                  {b.meal_name}
                </p>
                <p className="text-xs text-black/60">
                  {b.qty} servings · {b.labor_hours} hours of labor · cooks on{" "}
                  {b.date}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {b.ingredients_from.map((did) => {
                  const d = donationById.get(did);
                  return (
                    <span
                      key={did}
                      title={
                        d
                          ? `${d.donor} — ${d.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}`
                          : did
                      }
                      className="brutal-flat bg-teal-300 px-2 py-0.5 text-[11px] font-medium text-black"
                    >
                      📦 donated {d ? d.items[0]?.name.toLowerCase() : did}
                      {d ? ` (${d.donor})` : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <p className="font-heading text-[10px] font-extrabold uppercase tracking-wide">
          Kitchen capacity (hours of labor)
        </p>
        {kitchen.map((day) => {
          const used = laborByDate.get(day.date) ?? 0;
          const pct = Math.min(100, (used / day.labor_hours_available) * 100);
          return (
            <div key={day.date}>
              <div className="flex justify-between text-[11px] text-black/70">
                <span className="font-medium">{day.date}</span>
                <span className="font-mono tabular-nums">
                  {used} of {day.labor_hours_available} h ·{" "}
                  {day.equipment_slots} stations
                </span>
              </div>
              <div className="brutal-flat mt-1 h-3.5 overflow-hidden bg-white">
                <div
                  className={`h-full border-r-2 border-black transition-all ${
                    pct > 90 ? "bg-red-500" : "bg-secondary"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <p className="text-[11px] text-black/50">
          Batches run {kitchen[0]?.batch_min}–{kitchen[0]?.batch_max} servings ·
          week of {productionPlan.week}
        </p>
      </div>
    </div>
  );
}
