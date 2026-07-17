"use client";

/**
 * Group substitution (admin): from the weekly calendar, replace one day's
 * recipe for the whole group at once. Each alternative shows how many of the
 * affected clients it is safe for — the substitution applies only where every
 * safety check passes; anyone it isn't safe for keeps their original meal.
 */
import { useEffect, useMemo } from "react";
import Image from "next/image";
import { Users, X } from "lucide-react";
import type { Allocation } from "@/lib/types";
import { clientById, meals as allMeals, mealById } from "@/lib/data";
import { mealImageSrc } from "@/lib/mealImages";
import { checkMealForClient } from "@/lib/validators";
import { clearSwapsWhere, setSwapsBulk, useOverrides } from "@/lib/overrides";

export interface GroupSwapResult {
  replaced: number;
  kept: number;
  mealName: string;
}

export default function GroupSwapDrawer({
  day,
  dayLabel,
  mealId,
  effectiveAllocations,
  onApplied,
  onClose,
}: {
  day: string;
  dayLabel: string;
  mealId: string;
  effectiveAllocations: Allocation[];
  onApplied: (result: GroupSwapResult) => void;
  onClose: () => void;
}) {
  const current = mealById.get(mealId);
  const overrides = useOverrides();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The group: everyone scheduled for this meal on this day.
  const affected = useMemo(() => {
    const out: { clientId: number; servings: number }[] = [];
    for (const a of effectiveAllocations) {
      for (const it of a.items) {
        if (it.day === day && it.meal_id === mealId) {
          out.push({ clientId: a.client_id, servings: it.qty });
        }
      }
    }
    return out;
  }, [effectiveAllocations, day, mealId]);
  const totalServings = affected.reduce((s, a) => s + a.servings, 0);

  // Was this row itself created by a group substitution? Then offer undo.
  const cameFromSwap = useMemo(
    () =>
      Object.entries(overrides.swaps).some(
        ([k, v]) => k.endsWith(`:${day}`) && v === mealId,
      ),
    [overrides.swaps, day, mealId],
  );

  const candidates = useMemo(() => {
    return allMeals
      .filter((m) => m.id !== mealId)
      .map((m) => {
        const safeFor = affected.filter(({ clientId }) => {
          const client = clientById.get(clientId);
          return client ? checkMealForClient(m, client).pass : false;
        });
        return { meal: m, safeFor };
      })
      .filter((c) => c.safeFor.length > 0)
      .sort((a, b) => b.safeFor.length - a.safeFor.length || a.meal.sodium_mg - b.meal.sodium_mg)
      .slice(0, 10);
  }, [affected, mealId]);

  const apply = (candidateId: string) => {
    const candidate = mealById.get(candidateId);
    if (!candidate) return;
    const entries = affected
      .filter(({ clientId }) => {
        const client = clientById.get(clientId);
        return client ? checkMealForClient(candidate, client).pass : false;
      })
      .map(({ clientId }) => ({ clientId, day, mealId: candidateId }));
    setSwapsBulk(entries);
    onApplied({
      replaced: entries.length,
      kept: affected.length - entries.length,
      mealName: candidate.name,
    });
    onClose();
  };

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 p-3 backdrop-blur-[2px] sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="flex max-h-full w-[500px] max-w-[94vw] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.22)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-swap-title"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#e5e5e0] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6f6f3]">
              <Users size={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#62625b]">
                {dayLabel} · {current.name} · {totalServings} servings ·{" "}
                {affected.length} clients
              </p>
              <h2 id="group-swap-title" className="text-lg font-semibold text-black">
                Substitute for the whole group
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6f6f3] text-black transition-colors hover:bg-[#e5e5e0]"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <p className="border-b border-[#e5e5e0] bg-[#fbfbf9] px-5 py-2.5 text-[11px] leading-relaxed text-[#62625b]">
          Each option shows how many of these {affected.length}{" "}
          clients it is safe for. The substitution applies only where every safety check
          passes — anyone it isn&apos;t safe for keeps {current.name}.
        </p>

        {cameFromSwap && (
          <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e0] bg-[#fdf3e2] px-5 py-2.5">
            <p className="text-[11px] font-semibold text-[#6b4c11]">
              This recipe was substituted in by you.
            </p>
            <button
              onClick={() => {
                clearSwapsWhere(day, mealId);
                onClose();
              }}
              className="shrink-0 text-[11px] font-bold text-[#6b4c11] underline underline-offset-2"
            >
              Undo — back to the agents&apos; picks
            </button>
          </div>
        )}

        <ul className="min-h-0 flex-1 divide-y divide-[#f0f0ec] overflow-y-auto">
          {candidates.map(({ meal, safeFor }) => {
            const photo = mealImageSrc(meal.id);
            const full = safeFor.length === affected.length;
            return (
              <li key={meal.id} className="flex items-center gap-3 px-5 py-3">
                {photo ? (
                  <Image
                    src={photo}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="h-11 w-11 shrink-0 rounded-xl bg-[#f0efe9]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#211922]">{meal.name}</p>
                  <p className="font-mono text-[10px] tabular-nums text-[#62625b]">
                    {meal.calories} kcal · {meal.protein_g} g protein ·{" "}
                    {meal.carbs_g} g carbs · {meal.sodium_mg} mg sodium
                  </p>
                  <p
                    className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      full
                        ? "bg-[#c7f0da] text-[#103c25]"
                        : "bg-[#fdf3e2] text-[#6b4c11]"
                    }`}
                  >
                    {full
                      ? `Safe for all ${affected.length} clients`
                      : `Safe for ${safeFor.length} of ${affected.length} — the rest keep the original`}
                  </p>
                </div>
                <button
                  onClick={() => apply(meal.id)}
                  className="shrink-0 rounded-2xl bg-[#211922] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-black"
                >
                  Use this
                </button>
              </li>
            );
          })}
          {candidates.length === 0 && (
            <li className="px-5 py-6 text-sm text-[#62625b]">
              No other recipe in the catalog is safe for any of these clients.
            </li>
          )}
        </ul>
      </aside>
    </div>
  );
}
