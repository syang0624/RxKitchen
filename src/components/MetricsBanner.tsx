"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ShieldAlert } from "lucide-react";
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
    <div className="min-w-0 px-4 py-3 sm:px-5">
      <span className="block text-2xl font-semibold leading-tight tabular-nums text-[#211922]">
        {value}
      </span>
      <span className="mt-1 block text-xs font-semibold leading-4 text-[#33332e]">
        {label}
      </span>
      {sub && (
        <span className="mt-0.5 block text-[11px] leading-4 text-[#62625b]">
          {sub}
        </span>
      )}
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
  const detailsId = "live-safety-metrics";

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dadad3] bg-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
        <span
          className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold leading-none ${
            zero
              ? "border-[#b9ddc7] bg-[#e8f5ed] text-[#103c25]"
              : "border-[#e60023] bg-[#e60023] text-white"
          }`}
        >
          {zero ? (
            <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
          ) : (
            <ShieldAlert aria-hidden="true" className="size-4" />
          )}
          {zero
            ? "All plans safe"
            : `${metrics.clinicalViolations} safety issue${metrics.clinicalViolations > 1 ? "s" : ""}`}
        </span>

        <p className="min-w-52 flex-1 text-sm leading-5 text-[#62625b]">
          <span className="font-semibold text-[#33332e]">
            {metrics.totalClients} clients covered
          </span>{" "}
          <span aria-hidden="true">·</span>{" "}
          {checksRun.toLocaleString()} safety checks re-run live
        </p>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-2xl bg-[#f1f1ed] px-3.5 py-2 text-xs font-semibold text-[#211922] transition-colors hover:bg-[#e5e5e0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#435ee5]"
        >
          {expanded ? "Hide details" : "View details"}
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {expanded && (
        <div
          id={detailsId}
          className="border-t border-[#e5e5e0] bg-[#fbfbf9]"
        >
          <div className="grid divide-y divide-[#e5e5e0] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
            <Stat
              value={String(metrics.clinicalViolations)}
              label="Clinical safety issues"
              sub="Allergens, sodium, carbs and diet checked"
            />
            <Stat
              value={`${metrics.fullyCompliantPct.toFixed(1)}%`}
              label="Clients fully matched"
              sub={`Target ≥90% · ${metrics.totalClients} clients`}
            />
            <Stat
              value={`${metrics.coveragePct.toFixed(0)}%`}
              label="Clients covered"
              sub="Meals or grocery kit assigned"
            />
            <Stat
              value={`${metrics.donationUtilizationPct.toFixed(1)}%`}
              label="Donations put to use"
              sub="Target 75–80%"
            />
          </div>
          <p className="border-t border-[#e5e5e0] px-4 py-2.5 text-right text-[11px] tabular-nums text-[#62625b] sm:px-5">
            {metrics.mealsAllocated.toLocaleString()} meals scheduled
          </p>
        </div>
      )}
    </section>
  );
}
