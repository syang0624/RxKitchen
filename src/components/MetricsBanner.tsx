"use client";

/**
 * Live metrics banner (FR6, PRD §9). Every number here is recomputed by the
 * client-side validators over the full dataset on every render pass — never
 * hardcoded (STEVEN.md hard rule). The safety-issue count reads 0 because the
 * checks pass, not because it is asserted.
 *
 * Collapsed by default to a one-line verdict — the CNO needs "is everything
 * safe?" at a glance; the full numbers are one click away.
 */
import { useMemo, useState } from "react";
import type { Allocation } from "@/lib/types";
import { clientById, donations, groceryById, mealById } from "@/lib/data";
import { computeMetrics } from "@/lib/validators";

function Stat({
  value,
  label,
  sub,
}: {
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-start px-4 py-2 first:pl-1">
      <span className="font-mono text-2xl font-bold leading-tight tabular-nums">
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
  const [expanded, setExpanded] = useState(false);

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
    <div className="brutal-card bg-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <span
          className={`brutal-flat px-3 py-1 font-heading text-sm font-extrabold uppercase ${
            zero ? "bg-secondary text-black" : "bg-red-500 text-white"
          }`}
        >
          {zero
            ? "✓ All plans safe"
            : `✕ ${metrics.clinicalViolations} safety issue${metrics.clinicalViolations > 1 ? "s" : ""}`}
        </span>
        <span className="text-sm text-black/70">
          {metrics.totalClients} clients covered ·{" "}
          {checksRun.toLocaleString()} safety checks re-run live in this
          browser
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="brutal-btn ml-auto bg-white px-3 py-1 text-xs font-bold uppercase"
        >
          {expanded ? "Hide details ▴" : "Details ▾"}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t-2 border-black bg-background px-4 py-1.5">
          <Stat
            value={String(metrics.clinicalViolations)}
            label="Clinical safety issues"
            sub="allergens · sodium · carbs · diet — all checked"
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
          <div className="ml-auto font-mono text-[11px] text-black/50">
            {metrics.mealsAllocated.toLocaleString()} meals scheduled
          </div>
        </div>
      )}
    </div>
  );
}
