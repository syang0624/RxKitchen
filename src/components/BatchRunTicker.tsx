"use client";

/**
 * Live batch-run ticker: the agents processed all 150 referrals in the
 * overnight batch run — this replays that run so you can watch the pipeline
 * work in real time. Auto-plays once when the week view first loads; every
 * number is accumulated from the real allocations as each referral streams by.
 */
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import { allocations, clientById } from "@/lib/data";

const TICK_MS = 80;
const START_DELAY_MS = 800;

const AGENTS = ["Intake", "Clinical Matching", "Kitchen Planning", "Fallback Composer"];

export default function BatchRunTicker() {
  const total = allocations.length;
  const [idx, setIdx] = useState(-1); // -1 waiting to auto-start · 0..n-1 running · ≥n done
  const running = idx >= 0 && idx < total;
  const done = idx >= total;

  // Auto-start once so the landing view opens with the agents visibly working.
  useEffect(() => {
    const t = setTimeout(() => setIdx((i) => (i < 0 ? 0 : i)), START_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setIdx((i) => i + 1), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const processed = Math.min(Math.max(idx, 0), total);
  const stats = useMemo(() => {
    let meals = 0;
    let kits = 0;
    let batchClients = 0;
    for (const a of allocations.slice(0, processed)) {
      meals += a.items.reduce((s, i) => s + i.qty, 0);
      if (a.grocery_kit) kits++;
      if (a.items.some((i) => i.from_batch)) batchClients++;
    }
    return { meals, kits, batchClients };
  }, [processed]);

  const current = running ? allocations[idx] : null;
  const currentClient = current ? clientById.get(current.client_id) : null;
  const pct = (processed / total) * 100;

  return (
    <div className="rounded-2xl border border-[#dadad3] bg-white px-4 py-3 sm:px-5">
      <div className="flex min-h-9 items-center gap-x-4 overflow-hidden">
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-[#211922]">
          {done ? (
            <CheckCircle2 size={17} className="text-[#0f7a41]" aria-hidden />
          ) : (
            <Sparkles size={17} className="text-[#e60023]" aria-hidden />
          )}
          {done
            ? "Overnight batch run complete"
            : "Agents at work — overnight batch run"}
        </span>

        {running && currentClient && (
          <span className="min-w-0 flex-1 truncate text-xs text-[#62625b]">
            Processing referral{" "}
            <span className="font-mono tabular-nums">
              {processed + 1} of {total}
            </span>{" "}
            — <span className="font-semibold text-[#211922]">{currentClient.name}</span>
            {current!.grocery_kit ? " · composing grocery kit" : ""}
          </span>
        )}
        {done && (
          <span className="min-w-0 flex-1 truncate text-xs text-[#62625b]">
            {total} plans built · {stats.meals.toLocaleString()} meals scheduled ·{" "}
            {stats.batchClients} plans use fresh batches · 0 safety issues
          </span>
        )}
        {idx < 0 && (
          <span className="min-w-0 flex-1 truncate text-xs text-[#62625b]">
            {total} referrals queued for autonomous processing — starting…
          </span>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-3">
          {running &&
            AGENTS.map((a, i) => (
              <span
                key={a}
                className="hidden items-center gap-1.5 text-[11px] text-[#62625b] lg:flex"
              >
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#e60023]"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
                {a}
              </span>
            ))}
          {done && (
            <button
              onClick={() => setIdx(0)}
              title="Run the batch again"
              aria-label="Run the batch again"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f6f6f3] text-black transition-colors hover:bg-[#e5e5e0]"
            >
              <RotateCcw size={15} aria-hidden />
            </button>
          )}
        </span>
      </div>

      {/* progress */}
      <div className="mt-2.5 flex items-center gap-3">
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f0f0ec]">
          <div
            className={`h-full rounded-full transition-[width] duration-100 ${
              done ? "bg-[#0f7a41]" : "bg-[#e60023]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#62625b]">
          {processed}/{total}
        </span>
      </div>
    </div>
  );
}
