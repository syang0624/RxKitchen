"use client";

/**
 * Donation intake simulator (FR12, P2): drop off a new donation and watch the
 * Donation Triage Agent classify it live — a second pre-generated stream
 * (PRD §6), replayed inside a self-contained overlay so the main dashboard
 * stays uncluttered.
 */
import { useEffect, useRef } from "react";
import {
  donationById,
  donationRun,
  donationScenario,
  productionPlan,
} from "@/lib/data";
import { useReplay } from "@/lib/replay";
import { EventRow } from "./ActivityFeed";
import { formatClock } from "./ui";

export default function DonationSimulator({ onClose }: { onClose: () => void }) {
  const replay = useReplay(donationRun.events);

  const donation = donationById.get(donationScenario.donation_id ?? "");
  const routedBatchId = donation?.routed_to?.startsWith("batch:")
    ? donation.routed_to.slice("batch:".length)
    : null;
  const batch = routedBatchId
    ? productionPlan.batches.find((b) => b.id === routedBatchId)
    : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Follow the stream while it plays.
  const listRef = useRef<HTMLDivElement>(null);
  const count = replay.visibleEvents.length;
  useEffect(() => {
    const el = listRef.current;
    if (el && replay.playing) el.scrollTop = el.scrollHeight;
  }, [count, replay.playing]);

  if (!donation) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="brutal-card flex max-h-[88vh] w-[600px] max-w-[94vw] flex-col overflow-hidden bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b-2 border-black bg-teal-300 px-4 py-2.5">
          <h2 className="font-heading text-xs font-extrabold uppercase tracking-wide">
            📦 Donation intake simulator
          </h2>
          <button
            onClick={onClose}
            className="brutal-btn bg-white px-2 py-0.5 text-xs font-bold"
            aria-label="Close"
          >
            ✕ Close
          </button>
        </header>

        <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {/* the arriving donation */}
          <div className="brutal-box bg-background p-3">
            <p className="text-sm font-bold">
              A delivery just arrived from {donation.donor}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-xs text-black/80">
              {donation.items.map((it) => (
                <li key={it.name}>
                  • {it.name} — {it.qty} {it.unit}
                  {it.qty > 1 ? "s" : ""}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-black/60">
              Condition on arrival:{" "}
              <span className="font-bold text-black">{donation.condition}</span>{" "}
              · received {new Date(donation.received_at).toLocaleDateString()}
            </p>
          </div>

          {replay.idle ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-xs text-black/60">
                Every donation passes a food-safety gate before it can touch a
                meal. Drop this one off and watch the triage agent decide.
              </p>
              <button
                onClick={replay.play}
                className="brutal-btn bg-primary px-4 py-2 text-sm font-bold uppercase text-white"
              >
                📦 Drop off this donation
              </button>
            </div>
          ) : (
            <>
              <ul className="brutal-flat divide-y-2 divide-black/10 bg-white py-1">
                {replay.visibleEvents.map((e) => (
                  <EventRow key={e.seq} event={e} />
                ))}
                {replay.playing && (
                  <li className="flex items-center gap-2 px-4 py-3 text-xs text-black/60">
                    <span className="h-2 w-2 animate-pulse rounded-full border border-black bg-secondary" />
                    triaging…
                  </li>
                )}
              </ul>

              {/* outcome, once the stream finishes */}
              {replay.done && batch && (
                <div className="brutal-box bg-secondary/40 p-3 text-xs">
                  <p className="text-sm font-bold">
                    ✓ Accepted — routed to kitchen batch {batch.id}
                  </p>
                  <p className="mt-1 text-black/80">
                    These ingredients feed{" "}
                    <span className="font-bold text-black">{batch.meal_name}</span>{" "}
                    ({batch.qty} servings, cooks on {batch.date}). Donations that
                    fail the gate — expired or of unknown origin — are rejected
                    and never reach a meal.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {!replay.idle && (
          <footer className="flex items-center gap-2 border-t-2 border-black bg-background px-3 py-2">
            <button
              onClick={replay.toggle}
              className="brutal-btn bg-primary px-3 py-1 text-xs font-bold uppercase text-white"
            >
              {replay.playing ? "❚❚ Pause" : replay.done ? "↺ Replay" : "▶ Play"}
            </button>
            <button
              onClick={replay.skipToEnd}
              title="Skip to end"
              className="brutal-btn bg-white px-2 py-1 text-xs font-bold"
            >
              ⇥
            </button>
            <span className="ml-auto font-mono text-[11px] tabular-nums text-black/60">
              {formatClock(replay.time)} / {formatClock(replay.duration)}
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}
