"use client";

/**
 * The CNO's workflow state: what she has reviewed, approved, and triaged.
 * Agents propose; she approves — this is the human-in-the-loop layer the PRD
 * defers to production, scoped to the three demo decisions. Persisted in
 * localStorage so the product behaves like a tool, not a slideshow.
 */
import { useSyncExternalStore } from "react";

const KEY = "rxkitchen.workflow.v1";

export interface WorkflowState {
  /** Weekly menu approved and sent to the kitchen. */
  weekApprovedAt: string | null;
  /** The new referral's (hero's) draft plan approved. */
  heroApprovedAt: string | null;
  /** This morning's donation arrival triaged. */
  donationTriagedAt: string | null;
}

const EMPTY: WorkflowState = {
  weekApprovedAt: null,
  heroApprovedAt: null,
  donationTriagedAt: null,
};

let cached: WorkflowState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read(): WorkflowState {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) cached = { ...EMPTY, ...JSON.parse(raw) };
    } catch {
      // corrupted storage — fall back to a fresh workflow
    }
  }
  return cached;
}

function emit() {
  for (const l of listeners) l();
}

export function setWorkflow(patch: Partial<WorkflowState>) {
  cached = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // storage unavailable (private mode) — state still works for the session
  }
  emit();
}

export function resetWorkflow() {
  cached = EMPTY;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWorkflow(): WorkflowState {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/**
 * Human timestamp for approval stamps, e.g. "Jul 20, 9:14 AM".
 * Anchored to the demo's "today" (Monday, July 20, 2026) with the real
 * wall-clock time, so stamps stay consistent with the dataset's world.
 */
export function approvalStamp(): string {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Jul 20, ${time}`;
}
