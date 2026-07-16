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
  violation: "bg-red-500/80 text-zinc-950",
  full: "bg-emerald-500/70 text-zinc-950",
  batch: "bg-teal-500/60 text-zinc-950",
  kit: "bg-rose-400/70 text-zinc-950",
  none: "bg-zinc-800 text-zinc-400",
};

const LEGEND: { status: CellStatus; label: string }[] = [
  { status: "full", label: "existing meals (level 0)" },
  { status: "batch", label: "incl. kitchen batch (level 1)" },
  { status: "kit", label: "grocery kit (level 2)" },
  { status: "violation", label: "clinical violation" },
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
            className="flex items-center gap-1.5 text-[11px] text-zinc-400"
          >
            <span className={`h-3 w-3 rounded-sm ${STATUS_STYLE[status]}`} />
            {label} · {counts[status]}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-zinc-500">
          {cells.length} clients · every cell re-validated client-side
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1">
        {cells.map(({ alloc, client, status }) => (
          <button
            key={alloc.client_id}
            onClick={() => onSelectClient(alloc.client_id)}
            title={`${client?.name ?? "?"} — ${
              status === "violation" ? "VIOLATION" : `fallback level ${alloc.fallback_level}`
            }`}
            className={`rounded px-1 py-1.5 font-mono text-[10px] tabular-nums transition hover:ring-2 hover:ring-zinc-400 ${
              STATUS_STYLE[status]
            } ${alloc.client_id === selectedClientId ? "ring-2 ring-white" : ""}`}
          >
            {alloc.client_id}
          </button>
        ))}
      </div>
    </div>
  );
}
