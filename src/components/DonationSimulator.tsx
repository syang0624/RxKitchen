"use client";

/**
 * Donation intake simulator (FR12, P2): drop off a new donation and watch the
 * Donation Triage Agent classify it live — a second pre-generated stream
 * (PRD §6), replayed inside a self-contained overlay so the main dashboard
 * stays uncluttered.
 */
import { useEffect, useRef } from "react";
import {
  CheckCircle2,
  PackageOpen,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  X,
} from "lucide-react";
import { donationById, donationScenario, productionPlan } from "@/lib/data";
import type { AgentEvent } from "@/lib/types";
import { useReplay } from "@/lib/replay";
import { useDonationRun } from "@/lib/runs";
import { EventRow } from "./ActivityFeed";
import { formatClock } from "./ui";

const EMPTY_EVENTS: AgentEvent[] = [];

export default function DonationSimulator({ onClose }: { onClose: () => void }) {
  // The sim stream is anchored to whichever client draws from the target batch
  // first — that moves when the allocator changes, so load it by scenario.
  const donationRun = useDonationRun(donationScenario.client_id);
  const replay = useReplay(donationRun?.events ?? EMPTY_EVENTS);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-[2px] sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-[620px] flex-col overflow-hidden rounded-[32px] bg-white text-[#33332e] shadow-[0_16px_48px_rgba(0,0,0,0.22)] sm:max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="donation-simulator-title"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#e5e5e0] px-5 py-4 sm:px-8 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f6f6f3] text-[#211922]">
              <PackageOpen size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#62625b]">Donation triage</p>
              <h2
                id="donation-simulator-title"
                className="truncate text-lg font-semibold leading-tight text-black sm:text-[22px]"
              >
                Intake simulator
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f6f6f3] text-black transition-colors hover:bg-[#e5e5e0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#435ee5]"
            aria-label="Close"
            title="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6"
        >
          {/* the arriving donation */}
          <section className="rounded-2xl bg-[#f6f6f3] p-4 sm:p-5">
            <p className="text-base font-semibold text-black">
              A delivery just arrived from {donation.donor}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[#33332e]">
              {donation.items.map((it) => (
                <li key={it.name} className="flex items-center justify-between gap-4">
                  <span>{it.name}</span>
                  <span className="shrink-0 font-semibold text-black">
                    {it.qty} {it.unit}{it.qty > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-[#dadad3] pt-3 text-xs leading-relaxed text-[#62625b]">
              Condition on arrival:{" "}
              <span className="font-semibold text-black">{donation.condition}</span>{" "}
              · Received {new Date(donation.received_at).toLocaleDateString()}
            </p>
          </section>

          {replay.idle ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center sm:py-6">
              <p className="max-w-md text-sm leading-relaxed text-[#62625b]">
                Every donation passes a food-safety gate before it can touch a
                meal. Drop this one off and watch the triage agent decide.
              </p>
              <button
                onClick={replay.play}
                disabled={!donationRun}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#e60023] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#cc001f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#435ee5] disabled:opacity-50"
              >
                <PackageOpen size={18} aria-hidden="true" />
                {donationRun ? "Drop off this donation" : "Loading…"}
              </button>
            </div>
          ) : (
            <>
              <ul className="overflow-hidden rounded-2xl border border-[#e5e5e0] bg-white py-1 [&>li]:border-b [&>li]:border-[#e5e5e0] [&>li:last-child]:border-b-0">
                {replay.visibleEvents.map((e) => (
                  <EventRow key={e.seq} event={e} />
                ))}
                {replay.playing && (
                  <li className="flex items-center gap-2 px-4 py-3 text-xs text-[#62625b]">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#e60023]" />
                    Triaging…
                  </li>
                )}
              </ul>

              {/* outcome, once the stream finishes */}
              {replay.done && batch && (
                <div className="rounded-2xl bg-[#c7f0da] p-4 text-sm text-[#103c25] sm:p-5">
                  <p className="flex items-start gap-2 font-semibold">
                    <CheckCircle2 className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                    <span>Accepted · Routed to kitchen batch {batch.id}</span>
                  </p>
                  <p className="mt-2 leading-relaxed">
                    These ingredients feed{" "}
                    <span className="font-semibold">{batch.meal_name}</span>{" "}
                    ({batch.qty} servings, cooks on {batch.date}). Donations that
                    fail the gate, including expired or unknown-origin items, are rejected
                    and never reach a meal.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {!replay.idle && (
          <footer className="flex items-center gap-2 border-t border-[#e5e5e0] bg-[#fbfbf9] px-5 py-3 sm:px-8 sm:py-4">
            <button
              onClick={replay.toggle}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#e60023] px-4 text-sm font-bold text-white transition-colors hover:bg-[#cc001f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#435ee5]"
            >
              {replay.playing ? (
                <><Pause size={17} aria-hidden="true" /> Pause</>
              ) : replay.done ? (
                <><RotateCcw size={17} aria-hidden="true" /> Replay</>
              ) : (
                <><Play size={17} aria-hidden="true" /> Play</>
              )}
            </button>
            <button
              onClick={replay.skipToEnd}
              title="Skip to end"
              aria-label="Skip to end"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e5e5e0] text-black transition-colors hover:bg-[#c8c8c1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#435ee5]"
            >
              <SkipForward size={18} aria-hidden="true" />
            </button>
            <span className="ml-auto text-xs tabular-nums text-[#62625b]">
              {formatClock(replay.time)} / {formatClock(replay.duration)}
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}
