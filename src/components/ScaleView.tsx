"use client";

/**
 * Scale view (FR8, P1): all ~150 clients with live-validated match status.
 * Each cell's status comes from re-running the validators, not from the
 * generator's flags — the scale story stays honest.
 */
import { useMemo } from "react";
import type { Allocation } from "@/lib/types";
import { clientById, groceryById, mealById } from "@/lib/data";
import { validateAllocation } from "@/lib/validators";

type CellStatus = "violation" | "full" | "batch" | "kit" | "none";

const STATUS_STYLE: Record<CellStatus, string> = {
  violation: "bg-red-500 text-white",
  full: "bg-secondary text-black",
  batch: "bg-teal-300 text-black",
  kit: "bg-rose-300 text-black",
  none: "bg-white text-black/50",
};

const LEGEND: { status: CellStatus; label: string }[] = [
  { status: "full", label: "meals from stock" },
  { status: "batch", label: "includes kitchen batch" },
  { status: "kit", label: "includes grocery kit" },
  { status: "violation", label: "safety issue" },
];

export default function ScaleView({
  effectiveAllocations,
  selectedClientId,
  onSelectClient,
}: {
  effectiveAllocations: Allocation[];
  selectedClientId: number | null;
  onSelectClient: (id: number) => void;
}) {
  const cells = useMemo(
    () =>
      effectiveAllocations.map((alloc) => {
        const client = clientById.get(alloc.client_id);
        const violations = client
          ? validateAllocation(alloc, client, mealById, groceryById)
          : [{ rule: "integrity" }];
        const status: CellStatus =
          violations.length > 0
            ? "violation"
            : alloc.fallback_level === 0
              ? "full"
              : alloc.fallback_level === 1
                ? "batch"
                : "kit";
        return { alloc, client, status };
      }),
    [effectiveAllocations],
  );

  const counts = useMemo(() => {
    const c: Record<CellStatus, number> = {
      violation: 0,
      full: 0,
      batch: 0,
      kit: 0,
      none: 0,
    };
    for (const cell of cells) c[cell.status]++;
    return c;
  }, [cells]);

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap gap-3">
        {LEGEND.map(({ status, label }) => (
          <span
            key={status}
            className="flex items-center gap-1.5 text-[11px] font-medium"
          >
            <span className={`brutal-flat h-3.5 w-3.5 ${STATUS_STYLE[status]}`} />
            {label} · {counts[status]}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-black/60">
          {cells.length} clients · every square re-checked live for safety
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
        {cells.map(({ alloc, client, status }) => (
          <button
            key={alloc.client_id}
            onClick={() => onSelectClient(alloc.client_id)}
            title={`${client?.name ?? "?"} — ${
              status === "violation"
                ? "SAFETY ISSUE"
                : (LEGEND.find((l) => l.status === status)?.label ?? status)
            }`}
            className={`brutal-flat px-1 py-1.5 font-mono text-[10px] tabular-nums transition hover:-translate-y-0.5 ${
              STATUS_STYLE[status]
            } ${
              alloc.client_id === selectedClientId
                ? "shadow-[2px_2px_0_0_#000] ring-1 ring-black"
                : ""
            }`}
          >
            {alloc.client_id}
          </button>
        ))}
      </div>
    </div>
  );
}
