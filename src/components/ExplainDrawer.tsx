"use client";

/**
 * "Explain this decision" drawer (FR11, P2).
 *
 * For one scheduled meal, answers the CNO's question "why this meal, and is
 * it safe?" in plain words: every safety check with its full sentence
 * (recomputed live by the validators), what the agents said about it during
 * the run, and which alternatives were ruled out and why.
 */
import { useEffect, useMemo } from "react";
import Image from "next/image";
import { Check, Heart, ShieldCheck, X, XCircle } from "lucide-react";
import type { AgentEvent, Allocation, ClientProfile } from "@/lib/types";
import { meals as allMeals, mealById } from "@/lib/data";
import { mealImageSrc } from "@/lib/mealImages";
import { checkMealForClient } from "@/lib/validators";
import { AGENT_META, AgentBadge } from "./ui";

export default function ExplainDrawer({
  item,
  client,
  runEvents,
  onClose,
}: {
  item: Allocation["items"][number];
  client: ClientProfile;
  runEvents: AgentEvent[];
  onClose: () => void;
}) {
  const meal = mealById.get(item.meal_id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const verdict = useMemo(
    () => (meal ? checkMealForClient(meal, client) : null),
    [meal, client],
  );

  const mentions = useMemo(
    () => runEvents.filter((e) => e.data?.meal_id === item.meal_id),
    [runEvents, item.meal_id],
  );

  // Ruled-out alternatives, preferred cuisine first — recomputed live so the
  // explanation is as honest as the metrics banner.
  const alternatives = useMemo(() => {
    const failing = allMeals
      .map((m) => ({ meal: m, verdict: checkMealForClient(m, client) }))
      .filter((x) => !x.verdict.pass && x.meal.id !== item.meal_id);
    failing.sort(
      (a, b) =>
        Number(b.meal.cuisine === client.cuisine_pref) -
        Number(a.meal.cuisine === client.cuisine_pref),
    );
    return failing.slice(0, 3);
  }, [client, item.meal_id]);

  if (!meal) return null;
  const photo = mealImageSrc(meal.id);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 p-2 backdrop-blur-[2px] sm:p-3"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="flex h-full w-full max-w-[480px] flex-col overflow-hidden rounded-[32px] bg-white text-[#33332e] shadow-[0_16px_48px_rgba(0,0,0,0.22)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="explain-drawer-title"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#e5e5e0] px-5 py-4 sm:px-8 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f6f6f3] text-[#211922]">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-[#62625b]">Clinical rationale</p>
              <h2 id="explain-drawer-title" className="text-lg font-semibold leading-tight text-black sm:text-[22px]">
                Why this meal?
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f6f6f3] text-black transition-colors hover:bg-[#e5e5e0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#435ee5]"
            aria-label="Close"
            title="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
          {/* the meal */}
          <section className="overflow-hidden rounded-2xl bg-[#f6f6f3]">
            {photo && (
              <Image
                src={photo}
                alt={meal.name}
                width={1024}
                height={1024}
                className="h-44 w-full object-cover"
              />
            )}
            <div className="p-4 sm:p-5">
            <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-black">
              <span className="rounded-full bg-[#262622] px-3 py-1 text-xs font-bold text-white">
                {item.day}
              </span>
              {meal.name}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#62625b]">
              {meal.cuisine} · made with {meal.key_ingredients.join(", ")} ·{" "}
              <span className="font-medium text-[#33332e]">{meal.sodium_mg} mg</span> sodium ·{" "}
              <span className="font-medium text-[#33332e]">{meal.carbs_g} g</span> carbs
              {item.from_batch && (
                <span className="mt-3 block w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#33332e]">
                  Fresh from today&apos;s kitchen batch
                </span>
              )}
            </p>
            </div>
          </section>

          {/* safety checks, spelled out */}
          <section>
            <h3 className="text-sm font-bold text-black">
              Safety checks for {client.name.split(" ")[0]}
            </h3>
            <ul className="mt-3 space-y-2">
              {verdict?.checks.map((c) => (
                <li
                  key={c.rule}
                  className={`flex gap-3 rounded-2xl p-3 text-sm leading-relaxed ${
                    c.pass ? "bg-[#c7f0da] text-[#103c25]" : "bg-[#fff1f1] text-[#9e0a0a]"
                  }`}
                >
                  {c.pass ? (
                    <Check className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
                  ) : (
                    <XCircle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
                  )}
                  <span><strong className="font-semibold">{c.label}</strong> · {c.detail}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* what the agents said */}
          {mentions.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-black">
                What the agents said
              </h3>
              <ul className="mt-3 divide-y divide-[#e5e5e0] overflow-hidden rounded-2xl border border-[#e5e5e0] bg-white">
                {mentions.map((e) => (
                  <li
                    key={e.seq}
                    className={`border-l-4 p-4 ${AGENT_META[e.agent].edge}`}
                  >
                    <AgentBadge agent={e.agent} />
                    <p className="mt-2 text-sm font-semibold text-black">{e.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[#62625b]">
                      {e.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ruled-out alternatives */}
          {alternatives.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-black">
                Meals that were ruled out instead
              </h3>
              <ul className="mt-3 space-y-2">
                {alternatives.map(({ meal: alt, verdict: v }) => (
                  <li key={alt.id} className="rounded-2xl bg-[#f6f6f3] p-4 text-sm">
                    <p className="font-semibold text-black">
                      {alt.name}
                      {alt.cuisine === client.cuisine_pref && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#33332e]">
                          <Heart size={12} fill="currentColor" aria-hidden="true" />
                          Favorite cuisine
                        </span>
                      )}
                    </p>
                    <p className="mt-2 leading-relaxed text-[#62625b]">
                      <span className="font-semibold text-[#33332e]">Ruled out:</span>{" "}
                      {v.checks
                        .filter((c) => !c.pass)
                        .map((c) => c.label)
                        .join("; ")}
                      . Clinical limits are never relaxed, even for a
                      favorite.
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
