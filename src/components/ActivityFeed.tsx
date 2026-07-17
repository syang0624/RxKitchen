"use client";

/**
 * Agent activity feed (FR2): timestamped per-agent events with reasoning
 * snippets, streamed by the replay engine with realistic pacing. Includes
 * speed control, pause, and scrub for judge Q&A (PRD §6).
 */
import { useEffect, useRef } from "react";
import type { AgentEvent } from "@/lib/types";
import { REPLAY_SPEEDS, type Replay } from "@/lib/replay";
import { AGENT_META, AgentBadge, formatClock } from "./ui";

function EventRow({ event }: { event: AgentEvent }) {
  const meta = AGENT_META[event.agent];
  const result = event.data?.result;
  const isFail = result === "fail";
  const isPass = result === "pass";
  return (
    <li className={`border-l-4 px-3 py-2 ${meta.edge}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tabular-nums text-black/50">
          {formatClock(event.t_offset_ms)}
        </span>
        <AgentBadge agent={event.agent} />
        {event.type === "thought" && (
          <span className="text-[10px] italic text-black/50">thinking…</span>
        )}
        {isPass && (
          <span className="brutal-flat bg-secondary px-1.5 py-px text-[10px] font-bold text-black">
            SAFE ✓
          </span>
        )}
        {isFail && (
          <span className="brutal-flat bg-red-500 px-1.5 py-px text-[10px] font-bold text-white">
            EXCLUDED ✕
          </span>
        )}
        {event.type === "output" && (
          <span className="brutal-flat bg-primary px-1.5 py-px text-[10px] font-bold text-white">
            DONE
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
    <div className="flex flex-wrap items-center gap-2 border-t-2 border-black bg-background px-3 py-2">
      <button
        onClick={replay.toggle}
        title="Space = play/pause · ←/→ = scrub"
        className="brutal-btn bg-primary px-3 py-1 text-xs font-bold uppercase text-white"
      >
        {replay.playing ? "❚❚ Pause" : replay.done ? "↺ Replay" : "▶ Play"}
      </button>
      <button
        onClick={replay.restart}
        title="Restart"
        className="brutal-btn bg-white px-2 py-1 text-xs font-bold"
      >
        ⟲
      </button>
      <button
        onClick={replay.skipToEnd}
        title="Skip to end"
        className="brutal-btn bg-white px-2 py-1 text-xs font-bold"
      >
        ⇥
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
      <div className="brutal-flat flex overflow-hidden bg-white">
        {REPLAY_SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => replay.setSpeed(s)}
            className={`px-2 py-1 text-[11px] font-bold transition ${
              replay.speed === s
                ? "bg-black text-white"
                : "text-black hover:bg-secondary"
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
      <header className="flex items-center gap-2 border-b-2 border-black bg-background px-4 py-2.5">
        <h2 className="font-heading text-xs font-extrabold uppercase tracking-wide">
          Agent activity
        </h2>
        <span className="min-w-0 flex-1 truncate text-right text-xs text-black/60">
          {scenarioTitle}
        </span>
        {onHide && (
          <button
            onClick={onHide}
            title="Hide the agent activity feed"
            className="brutal-btn shrink-0 bg-white px-2 py-0.5 text-xs font-bold uppercase"
          >
            Hide ✕
          </button>
        )}
      </header>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {count === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="text-2xl">🛰</span>
            <p className="text-sm text-black/60">
              {replay.idle
                ? "Press Play to watch the agents build this plan."
                : "Waiting for the first agent event…"}
            </p>
          </div>
        ) : (
          <ul className="divide-y-2 divide-black/10 py-1">
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
