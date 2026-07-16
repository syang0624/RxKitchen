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
              className={`rounded-lg border p-3 transition-colors ${
                highlighted
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-zinc-800 bg-zinc-950/50"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-zinc-100">
                  <span className="mr-2 rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px] text-amber-300">
                    {b.id}
                  </span>
                  {b.meal_name}
                </p>
                <p className="text-xs text-zinc-400">
                  {b.qty} servings · {b.labor_hours} labor h · {b.date}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {b.ingredients_from.map((did) => {
                  const d = donationById.get(did);
                  return (
                    <span
                      key={did}
                      title={d ? `${d.donor} — ${d.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}` : did}
                      className="rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-300"
                    >
                      📦 {did}
                      {d ? ` · ${d.items[0]?.name}` : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Kitchen capacity (labor hours)
        </p>
        {kitchen.map((day) => {
          const used = laborByDate.get(day.date) ?? 0;
          const pct = Math.min(
            100,
            (used / day.labor_hours_available) * 100,
          );
          return (
            <div key={day.date}>
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>{day.date}</span>
                <span className="tabular-nums">
                  {used}/{day.labor_hours_available} h ·{" "}
                  {day.equipment_slots} slots
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct > 90 ? "bg-red-400" : "bg-amber-400"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <p className="text-[11px] text-zinc-600">
          Batch size {kitchen[0]?.batch_min}–{kitchen[0]?.batch_max} servings ·
          week of {productionPlan.week}
        </p>
      </div>
    </div>
  );
}
