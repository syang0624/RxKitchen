"use client";

/**
 * Agent activity feed (FR2): timestamped per-agent events with reasoning
 * snippets, streamed by the replay engine with realistic pacing. Includes
 * speed control, pause, and scrub for judge Q&A (PRD §6).
 */
import { useEffect, useRef } from "react";
import { Activity, EyeOff, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import type { AgentEvent } from "@/lib/types";
import { REPLAY_SPEEDS, type Replay } from "@/lib/replay";
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

function ReplayControls({ replay }: { replay: Replay }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[#e5e5e0] bg-white px-3 py-2">
      <button
        onClick={replay.toggle}
        title="Space = play/pause · ←/→ = scrub"
        className="brutal-btn inline-flex items-center gap-2 bg-primary px-4 text-xs font-bold text-white"
      >
        {replay.playing ? <Pause size={14} fill="currentColor" /> : replay.done ? <RotateCcw size={14} /> : <Play size={14} fill="currentColor" />}
        {replay.playing ? "Pause" : replay.done ? "Replay" : "Play"}
      </button>
      <button
        onClick={replay.restart}
        title="Restart"
        aria-label="Restart replay"
        className="brutal-btn inline-flex size-10 items-center justify-center bg-[#f6f6f3] text-xs font-bold"
      >
        <RotateCcw size={15} aria-hidden />
      </button>
      <button
        onClick={replay.skipToEnd}
        title="Skip to end"
        aria-label="Skip to end"
        className="brutal-btn inline-flex size-10 items-center justify-center bg-[#f6f6f3] text-xs font-bold"
      >
        <SkipForward size={15} fill="currentColor" aria-hidden />
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(replay.duration, 1)}
        step={100}
        value={replay.time}
        onChange={(e) => replay.seek(Number(e.target.value))}
        className="min-w-24 flex-1 accent-primary"
        aria-label="Scrub replay timeline"
      />
      <span className="font-mono text-[11px] tabular-nums text-black/60">
        {formatClock(replay.time)} / {formatClock(replay.duration)}
      </span>
      <div className="flex overflow-hidden rounded-full bg-[#f6f6f3] p-1">
        {REPLAY_SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => replay.setSpeed(s)}
            className={`min-h-8 rounded-full px-2 text-[11px] font-bold transition ${
              replay.speed === s
                ? "bg-black text-white"
                : "text-black hover:bg-[#e5e5e0]"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
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
                ? "Press Play to watch the agents build this plan."
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
      <ReplayControls replay={replay} />
    </section>
  );
}
