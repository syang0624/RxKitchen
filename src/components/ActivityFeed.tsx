"use client";

/**
 * Agent activity feed (FR2): timestamped per-agent events with reasoning
 * snippets, streamed by the replay engine with realistic pacing. Includes
 * speed control, pause, and scrub for judge Q&A (PRD §6).
 */
import { useEffect, useRef } from "react";
import { Activity, EyeOff, Pause, Play, RotateCcw } from "lucide-react";
import type { AgentEvent } from "@/lib/types";
import type { Replay } from "@/lib/replay";
import { AGENT_META, AgentBadge, formatClock } from "./ui";

export function EventRow({ event }: { event: AgentEvent }) {
  const meta = AGENT_META[event.agent];
  const result = event.data?.result;
  const isFail = result === "fail";
  const isPass = result === "pass";
  return (
    <li className={`border-l-4 px-4 py-3 ${meta.edge}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tabular-nums text-black/50">
          {formatClock(event.t_offset_ms)}
        </span>
        <AgentBadge agent={event.agent} />
        {event.type === "thought" && (
          <span className="text-[10px] italic text-black/50">thinking…</span>
        )}
        {isPass && (
          <span className="rounded-full bg-[#c7f0da] px-2 py-1 text-[10px] font-bold text-[#103c25]">
            Safe
          </span>
        )}
        {isFail && (
          <span className="rounded-full bg-[#fff0f1] px-2 py-1 text-[10px] font-bold text-[#9e0a0a]">
            Excluded
          </span>
        )}
        {event.type === "output" && (
          <span className="rounded-full bg-[#f6f6f3] px-2 py-1 text-[10px] font-bold text-black">
            Done
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-bold">{event.title}</p>
      <p
        className={`mt-0.5 text-xs leading-relaxed ${
          event.type === "thought" ? "italic text-black/50" : "text-black/70"
        }`}
      >
        {event.detail}
      </p>
    </li>
  );
}

/**
 * Process-style footer — deliberately not a media player. One primary action,
 * a thin work-progress track, and a shortcut to the finished plan.
 */
function AgentControls({ replay }: { replay: Replay }) {
  const pct =
    replay.duration > 0 ? Math.min(100, (replay.time / replay.duration) * 100) : 0;
  const steps = replay.visibleEvents.length;
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-[#e5e5e0] bg-white px-3 py-2">
      <button
        onClick={replay.toggle}
        title="Space = run/pause"
        className="brutal-btn inline-flex items-center gap-2 bg-primary px-4 text-xs font-bold text-white"
      >
        {replay.playing ? (
          <Pause size={14} fill="currentColor" />
        ) : replay.done ? (
          <RotateCcw size={14} />
        ) : (
          <Play size={14} fill="currentColor" />
        )}
        {replay.playing ? "Pause" : replay.done ? "Run again" : "Run agents"}
      </button>

      {replay.idle ? (
        <span className="text-xs text-[#62625b]">Agents standing by</span>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-[#f0f0ec]">
            <span
              className={`block h-full rounded-full transition-[width] duration-200 ${
                replay.done ? "bg-[#0f7a41]" : "bg-primary"
              }`}
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums text-[#62625b]">
            {replay.done
              ? `done · ${steps} step${steps === 1 ? "" : "s"}`
              : `${steps} step${steps === 1 ? "" : "s"}`}
          </span>
        </span>
      )}

      {!replay.done && !replay.idle && (
        <button
          onClick={replay.skipToEnd}
          className="ml-auto shrink-0 text-xs font-semibold text-[#62625b] underline underline-offset-2 hover:text-black"
        >
          Show final plan
        </button>
      )}
    </div>
  );
}

export default function ActivityFeed({
  replay,
  scenarioTitle,
  onHide,
}: {
  replay: Replay;
  scenarioTitle: string;
  onHide?: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const count = replay.visibleEvents.length;

  // Follow the stream: keep the newest event in view while playing.
  useEffect(() => {
    const el = listRef.current;
    if (el && replay.playing) el.scrollTop = el.scrollHeight;
  }, [count, replay.playing]);

  return (
    <section className="brutal-card flex min-h-0 flex-col overflow-hidden bg-white">
      <header className="flex min-h-14 items-center gap-2 border-b border-[#e5e5e0] bg-white px-4 py-2.5">
        <h2 className="font-heading text-sm font-bold">
          Agent activity
        </h2>
        <span className="min-w-0 flex-1 truncate text-right text-xs text-black/60">
          {scenarioTitle}
        </span>
        {onHide && (
          <button
            onClick={onHide}
            title="Hide the agent activity feed"
            aria-label="Hide agent activity"
            className="brutal-btn inline-flex size-10 shrink-0 items-center justify-center bg-[#f6f6f3] text-xs font-bold"
          >
            <EyeOff size={16} aria-hidden />
          </button>
        )}
      </header>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {count === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#f6f6f3] text-[#62625b]"><Activity size={22} aria-hidden /></span>
            <p className="text-sm text-black/60">
              {replay.idle
                ? "Run the agents to process this referral."
                : "Waiting for the first agent event…"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#e5e5e0] py-1">
            {replay.visibleEvents.map((e) => (
              <EventRow key={e.seq} event={e} />
            ))}
            {replay.playing && (
              <li className="flex items-center gap-2 px-4 py-3 text-xs text-black/60">
                <span className="h-2 w-2 animate-pulse rounded-full border border-black bg-secondary" />
                agents working…
              </li>
            )}
          </ul>
        )}
      </div>
      <AgentControls replay={replay} />
    </section>
  );
}
