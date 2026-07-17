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
import type { AgentEvent, Allocation, ClientProfile } from "@/lib/types";
import { meals as allMeals, mealById } from "@/lib/data";
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

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <aside
        className="brutal-card m-3 flex w-[440px] max-w-[92vw] flex-col overflow-hidden bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b-2 border-black bg-primary px-4 py-2.5 text-white">
          <h2 className="font-heading text-xs font-extrabold uppercase tracking-wide">
            Why this meal?
          </h2>
          <button
            onClick={onClose}
            className="brutal-btn bg-white px-2 py-0.5 text-xs font-bold text-black"
            aria-label="Close"
          >
            ✕ Close
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* the meal */}
          <div>
            <p className="flex items-center gap-2 text-base font-bold">
              <span className="brutal-flat bg-black px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase text-white">
                {item.day}
              </span>
              {meal.name}
            </p>
            <p className="mt-1 text-xs text-black/70">
              {meal.cuisine} · made with {meal.key_ingredients.join(", ")} ·{" "}
              <span className="font-mono">{meal.sodium_mg} mg</span> sodium ·{" "}
              <span className="font-mono">{meal.carbs_g} g</span> carbs
              {item.from_batch && (
                <span className="brutal-flat ml-1 bg-amber-300 px-1.5 py-px font-bold text-black">
                  fresh from today&apos;s kitchen batch
                </span>
              )}
            </p>
          </div>

          {/* safety checks, spelled out */}
          <div>
            <p className="font-heading text-[10px] font-extrabold uppercase tracking-wide">
              Safety checks for {client.name.split(" ")[0]}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {verdict?.checks.map((c) => (
                <li
                  key={c.rule}
                  className={`brutal-flat p-2 text-xs leading-relaxed ${
                    c.pass ? "bg-secondary/30" : "bg-red-100"
                  }`}
                >
                  <span className="font-bold">{c.pass ? "✓" : "✕"} {c.label}</span>
                  <span className="text-black/70"> — {c.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* what the agents said */}
          {mentions.length > 0 && (
            <div>
              <p className="font-heading text-[10px] font-extrabold uppercase tracking-wide">
                What the agents said
              </p>
              <ul className="mt-1.5 space-y-2">
                {mentions.map((e) => (
                  <li
                    key={e.seq}
                    className={`border-l-4 pl-2 ${AGENT_META[e.agent].edge}`}
                  >
                    <AgentBadge agent={e.agent} />
                    <p className="mt-1 text-xs font-bold">{e.title}</p>
                    <p className="text-xs leading-relaxed text-black/70">
                      {e.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ruled-out alternatives */}
          {alternatives.length > 0 && (
            <div>
              <p className="font-heading text-[10px] font-extrabold uppercase tracking-wide">
                Meals that were ruled out instead
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {alternatives.map(({ meal: alt, verdict: v }) => (
                  <li key={alt.id} className="brutal-flat bg-background p-2 text-xs">
                    <p className="font-bold">
                      {alt.name}
                      {alt.cuisine === client.cuisine_pref && (
                        <span className="brutal-flat ml-1 bg-primary px-1.5 py-px text-[10px] font-bold text-white">
                          ♥ their favorite cuisine
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-black/70">
                      Ruled out:{" "}
                      {v.checks
                        .filter((c) => !c.pass)
                        .map((c) => c.label)
                        .join("; ")}
                      . Clinical limits are never relaxed — not even for a
                      favorite.
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
