"use client";

/**
 * Intake queue (FR1): incoming referrals. Selecting the hero referral
 * (Client 1042) starts the pipeline replay; other clients were processed in
 * the batch run and open straight to their completed plan.
 */
import { useMemo, useState } from "react";
import type { ClientProfile } from "@/lib/types";
import { HERO_CLIENT_ID } from "@/lib/data";
import { SectionCard } from "./ui";

export default function IntakeQueue({
  clients,
  selectedId,
  heroProcessed,
  onSelect,
}: {
  clients: ClientProfile[];
  selectedId: number | null;
  /** Whether the hero replay has been run to completion at least once. */
  heroProcessed: boolean;
  onSelect: (id: number) => void;
}) {
  const [query, setQuery] = useState("");

  const ordered = useMemo(() => {
    const hero = clients.find((c) => c.id === HERO_CLIENT_ID);
    const rest = clients.filter((c) => c.id !== HERO_CLIENT_ID);
    return hero ? [hero, ...rest] : rest;
  }, [clients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        String(c.id).includes(q) ||
        c.referring_hospital.toLowerCase().includes(q),
    );
  }, [ordered, query]);

  return (
    <SectionCard title="Intake queue" subtitle={`${clients.length} referrals`}>
      <div className="sticky top-0 border-b border-zinc-800 bg-zinc-900/95 p-2 backdrop-blur">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, ID, hospital…"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
        />
      </div>
      <ul className="divide-y divide-zinc-800/70">
        {filtered.map((c) => {
          const isHero = c.id === HERO_CLIENT_ID;
          const isNew = isHero && !heroProcessed;
          const selected = c.id === selectedId;
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className={`w-full px-3 py-2 text-left transition-colors hover:bg-zinc-800/50 ${
                  selected ? "bg-zinc-800/80" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-zinc-200">
                    {c.name}
                  </span>
                  {isNew ? (
                    <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
                      NEW
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      processed
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                  #{c.id} · {c.referring_hospital}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.diet_orders.map((d) => (
                    <span
                      key={d}
                      className="rounded bg-zinc-800 px-1.5 py-px text-[10px] text-zinc-400"
                    >
                      {d}
                    </span>
                  ))}
                  {c.allergies.map((a) => (
                    <span
                      key={a}
                      className="rounded bg-red-500/10 px-1.5 py-px text-[10px] text-red-300"
                    >
                      ⚠ {a}
                    </span>
                  ))}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
