"use client";

/**
 * Swap-a-meal picker (admin): for one scheduled day, the CNO can replace the
 * meal — but the list only ever contains alternatives that pass every one of
 * this client's safety checks, recomputed live. Unsafe options simply do not
 * appear; clinical limits are not hers to override.
 */
import { useEffect, useMemo } from "react";
import Image from "next/image";
import { Repeat, X } from "lucide-react";
import type { Allocation, ClientProfile } from "@/lib/types";
import { meals as allMeals, mealById } from "@/lib/data";
import { mealImageSrc } from "@/lib/mealImages";
import { checkMealForClient } from "@/lib/validators";

export default function SwapMealDrawer({
  item,
  client,
  onSelect,
  onClose,
}: {
  item: Allocation["items"][number];
  client: ClientProfile;
  onSelect: (mealId: string) => void;
  onClose: () => void;
}) {
  const current = mealById.get(item.meal_id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const alternatives = useMemo(
    () =>
      allMeals
        .filter(
          (m) => m.id !== item.meal_id && checkMealForClient(m, client).pass,
        )
        .sort(
          (a, b) =>
            Number(b.cuisine === client.cuisine_pref) -
              Number(a.cuisine === client.cuisine_pref) ||
            a.sodium_mg - b.sodium_mg,
        )
        .slice(0, 10),
    [item.meal_id, client],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 p-3 backdrop-blur-[2px] sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="flex max-h-full w-[480px] max-w-[94vw] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.22)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-title"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#e5e5e0] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f6f6f3]">
              <Repeat size={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#62625b]">
                {item.day} · currently {current?.name}
              </p>
              <h2 id="swap-title" className="text-lg font-semibold text-black">
                Swap this meal
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
          Every option below already passes all of {client.name.split(" ")[0]}
          &apos;s safety checks — allergens, sodium, carbs, diet, and prep.
          Unsafe meals never appear here.
        </p>

        <ul className="min-h-0 flex-1 divide-y divide-[#f0f0ec] overflow-y-auto">
          {alternatives.map((m) => {
            const photo = mealImageSrc(m.id);
            return (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
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
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-[#211922]">
                    {m.name}
                    {m.cuisine === client.cuisine_pref && (
                      <span className="rounded-full bg-[#fff0f1] px-2 py-0.5 text-[10px] font-bold text-[#9e0a0a]">
                        ♥ favorite cuisine
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-[10px] tabular-nums text-[#62625b]">
                    {m.calories} kcal · {m.protein_g} g protein · {m.carbs_g} g
                    carbs · {m.sodium_mg} mg sodium
                  </p>
                </div>
                <button
                  onClick={() => onSelect(m.id)}
                  className="shrink-0 rounded-2xl bg-[#211922] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-black"
                >
                  Use this
                </button>
              </li>
            );
          })}
          {alternatives.length === 0 && (
            <li className="px-5 py-6 text-sm text-[#62625b]">
              No other meal in the catalog passes every safety check for this
              client.
            </li>
          )}
        </ul>
      </aside>
    </div>
  );
}
