"use client";

/**
 * NourishOS dashboard shell. Owns demo state: which referral is selected,
 * which pre-generated scenario stream is loaded (happy path / stockout
 * re-plan), and how far the replay has revealed the hero plan (PRD §4, §6).
 */
import { useMemo, useState } from "react";
import type { Allocation } from "@/lib/types";
import {
  HERO_CLIENT_ID,
  allocationByClientId,
  allocations,
  clientById,
  clients,
  delivery,
  happyPathScenario,
  heroRun,
  stockoutRun,
  stockoutScenario,
} from "@/lib/data";
import { useReplay } from "@/lib/replay";
import ActivityFeed from "./ActivityFeed";
import ClientPlanCard from "./ClientPlanCard";
import DeliveryPanel from "./DeliveryPanel";
import IntakeQueue from "./IntakeQueue";
import KitchenPlan from "./KitchenPlan";
import MetricsBanner from "./MetricsBanner";
import ScaleView from "./ScaleView";

type ScenarioId = "happy_path" | "stockout_replan";
type Tab = "kitchen" | "delivery" | "scale";

const EMPTY_EVENTS: never[] = [];

export default function Dashboard() {
  const [selectedClientId, setSelectedClientId] = useState<number>(HERO_CLIENT_ID);
  const [scenarioId, setScenarioId] = useState<ScenarioId>("happy_path");
  const [heroProcessed, setHeroProcessed] = useState(false);
  const [tab, setTab] = useState<Tab>("kitchen");

  const isHero = selectedClientId === HERO_CLIENT_ID;
  const activeRun = scenarioId === "happy_path" ? heroRun : stockoutRun;
  const scenario =
    scenarioId === "happy_path" ? happyPathScenario : stockoutScenario;

  // Only the hero referral has a pre-generated event stream; the other 149
  // were processed in the offline batch run and open straight to their plan.
  const replay = useReplay(isHero ? activeRun.events : EMPTY_EVENTS);

  // Render-time adjustment (no effect needed): the hero counts as processed
  // the moment its happy-path replay reaches the end.
  if (isHero && scenarioId === "happy_path" && replay.done && !heroProcessed) {
    setHeroProcessed(true);
  }

  // --- stockout re-plan (FR10): derive the swap from the event stream ---
  const depletedMealId = stockoutScenario.depleted_meal_id ?? null;
  const replacementMealId = useMemo(
    () =>
      stockoutRun.events.find(
        (e) => e.type === "check" && e.data?.result === "pass",
      )?.data?.meal_id ?? null,
    [],
  );
  const swapApplied =
    scenarioId === "stockout_replan" &&
    replay.visibleEvents.some(
      (e) => e.agent === "matching" && e.type === "output",
    );

  const effectiveAllocations = useMemo<Allocation[]>(() => {
    if (!swapApplied || !depletedMealId || !replacementMealId) {
      return allocations;
    }
    return allocations.map((a) => {
      if (a.client_id !== HERO_CLIENT_ID) return a;
      return {
        ...a,
        items: a.items.map((item) =>
          item.meal_id === depletedMealId
            ? {
                ...item,
                meal_id: replacementMealId,
                meal_name:
                  stockoutRun.events.find(
                    (e) => e.data?.meal_id === replacementMealId,
                  )?.title.replace("Replacement candidate: ", "") ??
                  replacementMealId,
                from_batch: null,
              }
            : item,
        ),
      };
    });
  }, [swapApplied, depletedMealId, replacementMealId]);

  const selectedClient = clientById.get(selectedClientId);
  const selectedAllocation = useMemo(
    () =>
      effectiveAllocations.find((a) => a.client_id === selectedClientId) ??
      allocationByClientId.get(selectedClientId),
    [effectiveAllocations, selectedClientId],
  );
  const selectedRoute = useMemo(
    () => delivery.batches.find((r) => r.clients.includes(selectedClientId)),
    [selectedClientId],
  );

  // --- progressive reveal during the hero's first replay (PRD §4 step 3) ---
  const revealGated = isHero && scenarioId === "happy_path" && !heroProcessed;
  const revealedMealIds = useMemo(() => {
    if (!revealGated) return null;
    return new Set(
      replay.visibleEvents
        .filter((e) => e.type === "check" && e.data?.result === "pass")
        .map((e) => e.data!.meal_id!)
        .filter(Boolean),
    );
  }, [revealGated, replay.visibleEvents]);
  const kitRevealed =
    !revealGated ||
    replay.visibleEvents.some(
      (e) => e.agent === "fallback" && e.type === "output",
    );
  const routeRevealed =
    !revealGated || replay.visibleEvents.some((e) => Boolean(e.data?.route_id));
  const highlightBatchIds = useMemo(
    () =>
      new Set(
        replay.visibleEvents
          .map((e) => e.data?.batch_id)
          .filter((id): id is string => Boolean(id)),
      ),
    [replay.visibleEvents],
  );

  const selectClient = (id: number) => {
    setSelectedClientId(id);
    if (id !== HERO_CLIENT_ID) return;
    // Re-selecting the hero before the run has completed keeps the pipeline story intact.
    if (!heroProcessed) setScenarioId("happy_path");
  };

  const triggerStockout = () => {
    setSelectedClientId(HERO_CLIENT_ID);
    setScenarioId("stockout_replan");
  };
  const backToHappyPath = () => setScenarioId("happy_path");

  return (
    <div className="flex h-dvh flex-col gap-3 bg-zinc-950 p-3 text-zinc-100">
      <header className="flex flex-wrap items-center gap-3 px-1">
        <h1 className="text-lg font-bold tracking-tight">
          🥗 NourishOS{" "}
          <span className="text-sm font-normal text-zinc-500">
            · agentic clinical meal allocation · week of 2026-07-20
          </span>
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {scenarioId === "stockout_replan" ? (
            <button
              onClick={backToHappyPath}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              ↺ Back to happy path
            </button>
          ) : (
            <button
              onClick={triggerStockout}
              disabled={!heroProcessed}
              title={
                heroProcessed
                  ? "Deplete a meal's stock and watch the agents re-plan"
                  : "Run the hero referral to completion first"
              }
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition enabled:hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ⚡ Trigger stockout re-plan
            </button>
          )}
        </div>
      </header>

      <MetricsBanner effectiveAllocations={effectiveAllocations} />

      <main className="grid min-h-0 flex-1 grid-cols-[260px_minmax(360px,1fr)_minmax(360px,440px)] gap-3">
        <IntakeQueue
          clients={clients}
          selectedId={selectedClientId}
          heroProcessed={heroProcessed}
          onSelect={selectClient}
        />
        <ActivityFeed
          replay={replay}
          scenarioTitle={
            isHero
              ? scenario.title
              : "Processed in offline batch run — select Client 1042 for the live pipeline replay"
          }
        />
        {selectedClient ? (
          <ClientPlanCard
            client={selectedClient}
            allocation={selectedAllocation}
            route={selectedRoute}
            revealedMealIds={revealedMealIds}
            kitRevealed={kitRevealed}
            routeRevealed={routeRevealed}
          />
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60" />
        )}
      </main>

      <section className="h-64 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="flex gap-1 border-b border-zinc-800 px-3 pt-2">
          {(
            [
              ["kitchen", "🍳 Kitchen production"],
              ["delivery", "🚚 Delivery routes"],
              ["scale", "📊 All 150 clients"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-t-lg px-3 py-1.5 text-xs font-medium transition ${
                tab === id
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-[calc(100%-2.4rem)] overflow-y-auto">
          {tab === "kitchen" && (
            <KitchenPlan highlightBatchIds={highlightBatchIds} />
          )}
          {tab === "delivery" && (
            <DeliveryPanel
              selectedClientId={selectedClientId}
              onSelectClient={selectClient}
            />
          )}
          {tab === "scale" && (
            <ScaleView
              effectiveAllocations={effectiveAllocations}
              selectedClientId={selectedClientId}
              onSelectClient={selectClient}
            />
          )}
        </div>
      </section>
    </div>
  );
}
