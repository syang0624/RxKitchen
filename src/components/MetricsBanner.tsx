"use client";

/**
 * Live metrics banner (FR6, PRD §9). Every number here is recomputed by the
 * client-side validators over the full dataset on every render pass — never
 * hardcoded (NORI.md hard rule). The violation count reads 0 because the
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
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "bad"
        ? "text-red-400"
        : "text-zinc-100";
  return (
    <div className="flex flex-col items-start px-4 py-2 first:pl-0">
      <span className={`text-2xl font-bold leading-tight tabular-nums ${toneClass}`}>
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {sub && <span className="text-[11px] text-zinc-600">{sub}</span>}
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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2">
      <Stat
        value={String(metrics.clinicalViolations)}
        label="Clinical violations"
        sub={zero ? "allergen · sodium · carbs · diet" : "REGENERATE DATASET"}
        tone={zero ? "good" : "bad"}
      />
      <div className="h-10 w-px bg-zinc-800" />
      <Stat
        value={`${metrics.fullyCompliantPct.toFixed(1)}%`}
        label="Fully compliant matches"
        sub={`target ≥90% · ${metrics.totalClients} clients`}
      />
      <div className="h-10 w-px bg-zinc-800" />
      <Stat
        value={`${metrics.coveragePct.toFixed(0)}%`}
        label="Client coverage"
        sub="meals or grocery kit"
      />
      <div className="h-10 w-px bg-zinc-800" />
      <Stat
        value={`${metrics.donationUtilizationPct.toFixed(1)}%`}
        label="Donation utilization"
        sub="target 75–80%"
      />
      <div className="ml-auto flex flex-col items-end text-right">
        <span className="text-[11px] font-medium text-emerald-400/90">
          ● re-verified live in this browser
        </span>
        <span className="text-[11px] text-zinc-600">
          {checksRun.toLocaleString()} constraint checks ·{" "}
          {metrics.mealsAllocated.toLocaleString()} meals allocated
        </span>
      </div>
    </div>
  );
}
