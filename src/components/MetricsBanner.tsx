"use client";

/**
 * Live metrics banner (FR6, PRD §9). Every number here is recomputed by the
 * client-side validators over the full dataset on every render pass — never
 * hardcoded (STEVEN.md hard rule). The safety-issue count reads 0 because the
 * checks pass, not because it is asserted.
 */
import { useMemo } from "react";
import type { Allocation } from "@/lib/types";
import { clientById, donations, groceryById, mealById } from "@/lib/data";
import { computeMetrics } from "@/lib/validators";

function Stat({
  value,
  label,
  sub,
  tone = "default",
}: {
  value: string;
  label: string;
  sub?: string;
  tone?: "good" | "bad" | "default";
}) {
  return (
    <div className="flex flex-col items-start px-4 py-2 first:pl-1">
      <span
        className={`font-mono text-2xl font-bold leading-tight tabular-nums ${
          tone === "good"
            ? "brutal-flat bg-secondary px-2 text-black"
            : tone === "bad"
              ? "brutal-flat bg-red-500 px-2 text-white"
              : "text-black"
        }`}
      >
        {value}
      </span>
      <span className="mt-1 font-heading text-[10px] font-extrabold uppercase tracking-wide">
        {label}
      </span>
      {sub && <span className="text-[11px] text-black/50">{sub}</span>}
    </div>
  );
}

export default function MetricsBanner({
  effectiveAllocations,
}: {
  /** Current allocations incl. any live re-plan (stockout swap). */
  effectiveAllocations: Allocation[];
}) {
  const metrics = useMemo(
    () =>
      computeMetrics(
        effectiveAllocations,
        clientById,
        mealById,
        groceryById,
        donations,
      ),
    [effectiveAllocations],
  );

  const checksRun = useMemo(
    () =>
      effectiveAllocations.reduce(
        (sum, a) =>
          sum + a.items.length * 5 + (a.grocery_kit?.items.length ?? 0) * 2,
        0,
      ),
    [effectiveAllocations],
  );

  const zero = metrics.clinicalViolations === 0;

  return (
    <div className="brutal-card flex flex-wrap items-center gap-x-2 gap-y-1 bg-white px-4 py-2">
      <Stat
        value={String(metrics.clinicalViolations)}
        label="Clinical safety issues"
        sub={
          zero
            ? "allergens · sodium · carbs · diet — all checked"
            : "STOP — REGENERATE THE DATASET"
        }
        tone={zero ? "good" : "bad"}
      />
      <div className="h-10 w-0.5 bg-black" />
      <Stat
        value={`${metrics.fullyCompliantPct.toFixed(1)}%`}
        label="Clients fully matched to meals"
        sub={`target ≥90% · ${metrics.totalClients} clients`}
      />
      <div className="h-10 w-0.5 bg-black" />
      <Stat
        value={`${metrics.coveragePct.toFixed(0)}%`}
        label="Clients covered"
        sub="meals or grocery kit — no one left out"
      />
      <div className="h-10 w-0.5 bg-black" />
      <Stat
        value={`${metrics.donationUtilizationPct.toFixed(1)}%`}
        label="Donations put to use"
        sub="target 75–80%"
      />
      <div className="ml-auto flex flex-col items-end text-right">
        <span className="brutal-flat bg-secondary px-2 py-0.5 text-[11px] font-bold text-black">
          ● every number re-checked live in this browser
        </span>
        <span className="mt-1 font-mono text-[11px] text-black/50">
          {checksRun.toLocaleString()} safety checks ·{" "}
          {metrics.mealsAllocated.toLocaleString()} meals scheduled
        </span>
      </div>
    </div>
  );
}
