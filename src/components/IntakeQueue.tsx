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
      <div className="sticky top-0 border-b-2 border-black bg-white p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or hospital…"
          className="brutal-flat w-full bg-background px-2.5 py-1.5 text-xs text-black placeholder-black/40 outline-none focus:bg-white"
        />
      </div>
      <ul className="divide-y-2 divide-black/10">
        {filtered.map((c) => {
          const isHero = c.id === HERO_CLIENT_ID;
          const isNew = isHero && !heroProcessed;
          const selected = c.id === selectedId;
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className={`w-full px-3 py-2 text-left transition-colors hover:bg-secondary/30 ${
                  selected ? "bg-secondary/50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold">{c.name}</span>
                  {isNew ? (
                    <span className="brutal-flat flex items-center gap-1 bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      New
                    </span>
                  ) : (
                    <span className="brutal-flat bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-black">
                      Plan ready
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-black/60">
                  {c.referring_hospital}{" "}
                  <span className="font-mono text-black/40">#{c.id}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.diet_orders.map((d) => (
                    <span
                      key={d}
                      className="brutal-flat bg-background px-1.5 py-px text-[10px] font-medium"
                    >
                      {d} diet
                    </span>
                  ))}
                  {c.allergies.map((a) => (
                    <span
                      key={a}
                      className="brutal-flat bg-red-400 px-1.5 py-px text-[10px] font-bold text-black"
                    >
                      ⚠ {a} allergy
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
