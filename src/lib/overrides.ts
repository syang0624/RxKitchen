"use client";

/**
 * The CNO's admin edits: per-client meal swaps and week holds. Layered over
 * the generated allocations at render time — the validators re-check the
 * edited plans exactly like the originals, so an edit can never silently
 * bypass a safety rule. Persisted in localStorage, same pattern as
 * src/lib/workflow.ts.
 */
import { useSyncExternalStore } from "react";

const KEY = "rxkitchen.admin.v1";

export interface AdminOverrides {
  /** "clientId:day" → replacement meal_id chosen by the CNO. */
  swaps: Record<string, string>;
  /** Clients whose deliveries are on hold this week. */
  holds: number[];
}

const EMPTY: AdminOverrides = { swaps: {}, holds: [] };

let cached: AdminOverrides = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read(): AdminOverrides {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) cached = { ...EMPTY, ...JSON.parse(raw) };
    } catch {
      // corrupted storage — start clean
    }
  }
  return cached;
}

function persist(next: AdminOverrides) {
  cached = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode — session-only
  }
  for (const l of listeners) l();
}

export const swapKey = (clientId: number, day: string) => `${clientId}:${day}`;

export function setSwap(clientId: number, day: string, mealId: string) {
  const s = read();
  persist({ ...s, swaps: { ...s.swaps, [swapKey(clientId, day)]: mealId } });
}

export function clearSwap(clientId: number, day: string) {
  const s = read();
  const swaps = { ...s.swaps };
  delete swaps[swapKey(clientId, day)];
  persist({ ...s, swaps });
}

export function toggleHold(clientId: number) {
  const s = read();
  const holds = s.holds.includes(clientId)
    ? s.holds.filter((id) => id !== clientId)
    : [...s.holds, clientId];
  persist({ ...s, holds });
}

export function resetOverrides() {
  cached = EMPTY;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOverrides(): AdminOverrides {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
