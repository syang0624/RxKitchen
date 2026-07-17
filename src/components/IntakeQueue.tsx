"use client";

/**
 * Intake queue (FR1): incoming referrals. Selecting the hero referral
 * (Client 1042) starts the pipeline replay; other clients were processed in
 * the batch run and open straight to their completed plan.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
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
      <div className="sticky top-0 z-10 border-b border-[#e5e5e0] bg-white p-3">
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#62625b]"
            aria-hidden
          />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or hospital…"
          aria-label="Search referrals"
          className="h-11 w-full rounded-full border-0 bg-[#f6f6f3] pl-10 pr-4 text-xs text-black outline-none placeholder:text-[#91918c] focus:bg-white focus:ring-1 focus:ring-[#c8c8c1]"
        />
        </label>
      </div>
      <ul className="divide-y divide-[#e5e5e0]">
        {filtered.map((c) => {
          const isHero = c.id === HERO_CLIENT_ID;
          const isNew = isHero && !heroProcessed;
          const selected = c.id === selectedId;
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-[#f6f6f3] ${
                  selected ? "bg-[#f6f6f3] shadow-[inset_3px_0_0_#e60023]" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold">{c.name}</span>
                  {isNew ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      New
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#c7f0da] px-2 py-1 text-[10px] font-bold text-[#103c25]">
                      Plan ready
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-black/60">
                  {c.referring_hospital}{" "}
                  <span className="font-mono text-black/40">#{c.id}</span>
                </div>
                {c.allergies.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.allergies.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1 rounded-full bg-[#fff0f1] px-2 py-1 text-[10px] font-semibold text-[#9e0a0a]"
                      >
                        <AlertTriangle size={11} aria-hidden /> {a} allergy
                      </span>
                    ))}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
