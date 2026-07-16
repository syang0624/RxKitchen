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
    <li className={`border-l-2 px-3 py-2 ${meta.border.replace("border-", "border-l-")}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tabular-nums text-zinc-600">
          {formatClock(event.t_offset_ms)}
        </span>
        <AgentBadge agent={event.agent} />
        {event.type === "thought" && (
          <span className="text-[10px] italic text-zinc-500">thinking…</span>
        )}
        {isPass && (
          <span className="rounded bg-emerald-500/15 px-1.5 py-px text-[10px] font-semibold text-emerald-300">
            PASS
          </span>
        )}
        {isFail && (
          <span className="rounded bg-red-500/15 px-1.5 py-px text-[10px] font-semibold text-red-300">
            EXCLUDED
          </span>
        )}
        {event.type === "output" && (
          <span className="rounded bg-zinc-700/60 px-1.5 py-px text-[10px] font-semibold text-zinc-300">
            OUTPUT
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium text-zinc-200">{event.title}</p>
      <p className={`mt-0.5 text-xs leading-relaxed ${event.type === "thought" ? "italic text-zinc-500" : "text-zinc-400"}`}>
        {event.detail}
      </p>
    </li>
  );
}

function ReplayControls({ replay }: { replay: Replay }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 px-3 py-2">
      <button
        onClick={replay.toggle}
        className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-900 transition hover:bg-white"
      >
        {replay.playing ? "❚❚ Pause" : replay.done ? "↺ Replay" : "▶ Play"}
      </button>
      <button
        onClick={replay.restart}
        title="Restart"
        className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
      >
        ⟲
      </button>
      <button
        onClick={replay.skipToEnd}
        title="Skip to end"
        className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
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
        className="min-w-24 flex-1 accent-emerald-400"
        aria-label="Scrub replay timeline"
      />
      <span className="font-mono text-[11px] tabular-nums text-zinc-500">
        {formatClock(replay.time)} / {formatClock(replay.duration)}
      </span>
      <div className="flex overflow-hidden rounded-lg border border-zinc-700">
        {REPLAY_SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => replay.setSpeed(s)}
            className={`px-2 py-1 text-[11px] font-medium transition ${
              replay.speed === s
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-400 hover:bg-zinc-800"
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
}: {
  replay: Replay;
  scenarioTitle: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const count = replay.visibleEvents.length;

  // Follow the stream: keep the newest event in view while playing.
  useEffect(() => {
    const el = listRef.current;
    if (el && replay.playing) el.scrollTop = el.scrollHeight;
  }, [count, replay.playing]);

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-200">
          Agent activity
        </h2>
        <span className="truncate text-xs text-zinc-500">{scenarioTitle}</span>
      </header>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {count === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <span className="text-2xl">🛰</span>
            <p className="text-sm text-zinc-400">
              {replay.idle
                ? "Press Play to replay the pipeline for this referral."
                : "Waiting for the first agent event…"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/60 py-1">
            {replay.visibleEvents.map((e) => (
              <EventRow key={e.seq} event={e} />
            ))}
            {replay.playing && (
              <li className="flex items-center gap-2 px-4 py-3 text-xs text-zinc-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
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
