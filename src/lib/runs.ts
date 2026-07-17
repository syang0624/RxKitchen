"use client";

/**
 * On-demand agent-run loading (FR8). Every client has a pre-generated
 * `data/agent_runs/client-<id>.json`; importing them all statically would
 * bloat the initial bundle, so non-hero runs are code-split and fetched the
 * moment a client is selected. Still zero network dependencies at demo time —
 * the JSON is bundled at build, just in lazy chunks.
 */
import { useEffect, useState } from "react";
import type { AgentRun } from "./types";

export async function loadAgentRun(clientId: number): Promise<AgentRun | null> {
  try {
    const mod = await import(`../../data/agent_runs/client-${clientId}.json`);
    return mod.default as AgentRun;
  } catch {
    return null;
  }
}

/** Loads a client's run; returns null while loading or if none exists. */
export function useAgentRun(clientId: number | null): AgentRun | null {
  // Keyed state so a stale run never leaks across a selection change
  // (render-time adjustment, same pattern as useReplay's stream reset).
  const [state, setState] = useState<{
    clientId: number | null;
    run: AgentRun | null;
  }>({ clientId, run: null });

  if (state.clientId !== clientId) {
    setState({ clientId, run: null });
  }

  useEffect(() => {
    let cancelled = false;
    if (clientId === null) return;
    loadAgentRun(clientId).then((run) => {
      if (!cancelled) {
        setState((s) => (s.clientId === clientId ? { clientId, run } : s));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return state.clientId === clientId ? state.run : null;
}
