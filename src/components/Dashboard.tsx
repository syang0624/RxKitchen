"use client";

/**
 * NourishOS dashboard shell. Owns demo state: which referral is selected,
 * which pre-generated scenario stream is loaded (happy path / stockout
 * re-plan), and how far the replay has revealed the hero plan (PRD §4, §6).
 */
import { useEffect, useMemo, useState } from "react";
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
import { useAgentRun } from "@/lib/runs";
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

  // The hero's streams ship in the main bundle for an instant demo start;
  // every other client's batch-run stream is code-split and loaded on select
  // (FR8: any of the 150 plans can be replayed).
  const nonHeroRun = useAgentRun(isHero ? null : selectedClientId);
  const activeEvents = isHero
    ? activeRun.events
    : (nonHeroRun?.events ?? EMPTY_EVENTS);
  const replay = useReplay(activeEvents);

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

  // Judge Q&A shortcuts (Phase 5): space = play/pause, ←/→ = scrub 5 s.
  const { toggle, seek, time } = replay;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seek(time - 5000);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seek(time + 5000);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seek, time]);

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
    <div className="flex h-dvh flex-col gap-3 bg-background p-3 text-black">
      <header className="flex flex-wrap items-center gap-3 px-1">
        <h1 className="font-heading text-xl font-extrabold uppercase tracking-tight">
          🥗 NourishOS{" "}
          <span className="font-sans text-sm font-normal normal-case text-black/60">
            · meal plans for the week of July 20, 2026
            <span className="ml-2 font-mono text-[11px] text-black/40">
              space = play/pause · ←/→ = scrub
            </span>
          </span>
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {scenarioId === "stockout_replan" ? (
            <button
              onClick={backToHappyPath}
              className="brutal-btn bg-white px-3 py-1.5 text-xs font-bold uppercase"
            >
              ↺ Back to the plan
            </button>
          ) : (
            <button
              onClick={triggerStockout}
              disabled={!heroProcessed}
              title={
                heroProcessed
                  ? "Mark a meal out of stock and watch the plan repair itself"
                  : "Play Rosa's referral to the end first"
              }
              className="brutal-btn bg-red-500 px-3 py-1.5 text-xs font-bold uppercase text-white"
            >
              ⚡ What if a meal runs out?
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
              : nonHeroRun
                ? `How ${selectedClient?.name ?? "this client"}'s plan was built — press Play`
                : "Loading this client's pipeline run…"
          }
        />
        {selectedClient ? (
          <ClientPlanCard
            client={selectedClient}
            allocation={selectedAllocation}
            route={selectedRoute}
            runEvents={activeEvents}
            revealedMealIds={revealedMealIds}
            kitRevealed={kitRevealed}
            routeRevealed={routeRevealed}
          />
        ) : (
          <div className="brutal-card bg-white" />
        )}
      </main>

      <section className="brutal-card h-64 shrink-0 overflow-hidden bg-white">
        <div className="flex gap-2 border-b-2 border-black bg-background px-3 py-2">
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
              className={`brutal-btn px-3 py-1 text-xs font-bold uppercase ${
                tab === id ? "bg-primary text-white" : "bg-white text-black"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="h-[calc(100%-3.1rem)] overflow-y-auto">
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
