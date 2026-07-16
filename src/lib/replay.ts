"use client";

/**
 * Event-replay engine (FR2, PRD §6).
 *
 * Consumes an agent-run event stream (`AgentEvent[]`, scheduled by
 * `t_offset_ms`) and advances a clock on a timer with configurable speed,
 * pause, and scrub. The consumer only ever sees "events visible at the
 * current clock" — the same interface a live agent API would feed (PRD §11),
 * so swapping the replay for live inference later means replacing this hook,
 * not the UI.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentEvent } from "./types";

export const REPLAY_SPEEDS = [0.5, 1, 2, 4] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

/** Padding after the last event so the feed visibly "settles" before done. */
const TAIL_MS = 600;
const TICK_MS = 50;

export interface Replay {
  /** Events whose t_offset_ms has been reached, in seq order. */
  visibleEvents: AgentEvent[];
  /** Current clock position in ms. */
  time: number;
  /** Total run length in ms. */
  duration: number;
  playing: boolean;
  /** True once the clock has reached the end of the stream. */
  done: boolean;
  /** True until play() is first called (or the clock is moved). */
  idle: boolean;
  speed: ReplaySpeed;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  restart: () => void;
  skipToEnd: () => void;
  /** Scrub to an absolute clock position (ms). */
  seek: (ms: number) => void;
  setSpeed: (s: ReplaySpeed) => void;
}

export function useReplay(events: AgentEvent[]): Replay {
  const duration = useMemo(
    () =>
      events.length
        ? Math.max(...events.map((e) => e.t_offset_ms)) + TAIL_MS
        : 0,
    [events],
  );

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [idle, setIdle] = useState(true);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);

  // Reset the clock when a different event stream is loaded (render-time
  // adjustment — https://react.dev/learn/you-might-not-need-an-effect).
  const [prevEvents, setPrevEvents] = useState(events);
  if (prevEvents !== events) {
    setPrevEvents(events);
    setTime(0);
    setPlaying(false);
    setIdle(true);
  }

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const delta = (now - last) * speed;
      last = now;
      setTime((t) => {
        const next = t + delta;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, duration, speed]);

  const done = duration > 0 && time >= duration;

  const play = useCallback(() => {
    setIdle(false);
    setTime((t) => (duration > 0 && t >= duration ? 0 : t));
    setPlaying(true);
  }, [duration]);

  const pause = useCallback(() => setPlaying(false), []);

  const toggle = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, play, pause]);

  const restart = useCallback(() => {
    setIdle(false);
    setTime(0);
    setPlaying(true);
  }, []);

  const skipToEnd = useCallback(() => {
    setIdle(false);
    setPlaying(false);
    setTime(duration);
  }, [duration]);

  const seek = useCallback(
    (ms: number) => {
      setIdle(false);
      setTime(Math.min(Math.max(ms, 0), duration));
    },
    [duration],
  );

  const visibleEvents = useMemo(
    () => events.filter((e) => e.t_offset_ms <= time),
    [events, time],
  );

  return {
    visibleEvents,
    time,
    duration,
    playing,
    done,
    idle,
    speed,
    play,
    pause,
    toggle,
    restart,
    skipToEnd,
    seek,
    setSpeed,
  };
}
