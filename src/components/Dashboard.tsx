"use client";

/**
 * RxKitchen dashboard shell. Owns demo state: which referral is selected,
 * which pre-generated scenario stream is loaded (happy path / stockout
 * re-plan), and how far the replay has revealed the hero plan (PRD §4, §6).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  ChefHat,
  HelpCircle,
  HeartPulse,
  PackagePlus,
  Play,
  RotateCcw,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import type { Allocation } from "@/lib/types";
import {
  HERO_CLIENT_ID,
  allocationByClientId,
  allocations,
  clientById,
  clients,
  donations,
  groceryById,
  happyPathScenario,
  heroRun,
  mealById,
  stockoutRun,
  stockoutScenario,
} from "@/lib/data";
import { useReplay } from "@/lib/replay";
import { useAgentRun } from "@/lib/runs";
import { computeMetrics } from "@/lib/validators";
import { approvalStamp, setWorkflow, useWorkflow } from "@/lib/workflow";
import { swapKey, useOverrides } from "@/lib/overrides";
import ActionInbox from "./ActionInbox";
import HelpGuide, { markHelpSeen, useHelpSeen } from "./HelpGuide";
import ActivityFeed from "./ActivityFeed";
import BatchRunTicker from "./BatchRunTicker";
import ClientPlanCard from "./ClientPlanCard";
import DonationSimulator from "./DonationSimulator";
import IntakeQueue from "./IntakeQueue";
import KitchenPlan from "./KitchenPlan";
import MetricsBanner from "./MetricsBanner";
import KitchenPrintSheet from "./KitchenPrintSheet";
import ScaleView from "./ScaleView";
import SupplyProjection from "./SupplyProjection";
import WeeklyCookList from "./WeeklyCookList";

type ScenarioId = "happy_path" | "stockout_replan";
type Tab = "kitchen" | "scale";
type View = "week" | "clients";

const EMPTY_EVENTS: never[] = [];

export default function Dashboard() {
  const [selectedClientId, setSelectedClientId] = useState<number>(HERO_CLIENT_ID);
  const [scenarioId, setScenarioId] = useState<ScenarioId>("happy_path");
  const [heroProcessed, setHeroProcessed] = useState(false);
  const [tab, setTab] = useState<Tab>("kitchen");
  // Progressive disclosure: the CNO sees the plan first; the agent feed and
  // the operations panel are one click away.
  const [feedOpen, setFeedOpen] = useState(true); // hero demo starts here
  const [opsOpen, setOpsOpen] = useState(false);
  const [donationSimOpen, setDonationSimOpen] = useState(false);
  // Land on the holistic picture: what the kitchen cooks for everyone.
  const [view, setView] = useState<View>("week");

  const workflow = useWorkflow();
  const overrides = useOverrides();
  const helpSeen = useHelpSeen();
  const [helpOpen, setHelpOpen] = useState(false);
  const showHelp = helpOpen || !helpSeen;
  const closeHelp = () => {
    markHelpSeen();
    setHelpOpen(false);
  };

  const totalMeals = useMemo(
    () =>
      allocations.reduce(
        (sum, a) => sum + a.items.reduce((n, it) => n + it.qty, 0),
        0,
      ),
    [],
  );

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

  // The CNO's meal swaps, layered over the generated plans. The validators
  // re-check swapped meals like any other, so edits can't bypass safety.
  const adminAllocations = useMemo<Allocation[]>(() => {
    if (Object.keys(overrides.swaps).length === 0) return allocations;
    return allocations.map((a) => {
      let changed = false;
      const items = a.items.map((item) => {
        const swappedId = overrides.swaps[swapKey(a.client_id, item.day)];
        const meal = swappedId ? mealById.get(swappedId) : undefined;
        if (!meal || meal.id === item.meal_id) return item;
        changed = true;
        return { ...item, meal_id: meal.id, meal_name: meal.name, from_batch: null };
      });
      return changed ? { ...a, items } : a;
    });
  }, [overrides.swaps]);

  const effectiveAllocations = useMemo<Allocation[]>(() => {
    if (!swapApplied || !depletedMealId || !replacementMealId) {
      return adminAllocations;
    }
    return adminAllocations.map((a) => {
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
  }, [adminAllocations, swapApplied, depletedMealId, replacementMealId]);

  // Held clients drop out of everything operational: cooking, metrics,
  // supply math, and the printed sheet. Their plan card shows the hold.
  const activeAllocations = useMemo<Allocation[]>(
    () =>
      overrides.holds.length === 0
        ? effectiveAllocations
        : effectiveAllocations.filter((a) => !overrides.holds.includes(a.client_id)),
    [effectiveAllocations, overrides.holds],
  );

  // Live safety re-verification gates the weekly approval (agents propose,
  // the CNO approves — never on red).
  const violations = useMemo(
    () =>
      computeMetrics(activeAllocations, clientById, mealById, groceryById, donations)
        .clinicalViolations,
    [activeAllocations],
  );

  const selectedClient = clientById.get(selectedClientId);
  const selectedAllocation = useMemo(
    () =>
      effectiveAllocations.find((a) => a.client_id === selectedClientId) ??
      allocationByClientId.get(selectedClientId),
    [effectiveAllocations, selectedClientId],
  );
  // --- progressive reveal during the hero's first replay (PRD §4 step 3) ---
  // Progressive reveal only while the replay is actually running — a CNO
  // reviewing the draft must see the full plan without pressing Play.
  const revealGated =
    isHero && scenarioId === "happy_path" && !heroProcessed && !replay.idle;
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
      if (donationSimOpen) return; // simulator owns the keyboard while open
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
  }, [toggle, seek, time, donationSimOpen]);

  const selectClient = (id: number) => {
    setSelectedClientId(id);
    setView("clients");
    if (id !== HERO_CLIENT_ID) return;
    // Re-selecting the hero before the run has completed keeps the pipeline story intact.
    if (!heroProcessed) {
      setScenarioId("happy_path");
      setFeedOpen(true);
    }
  };

  const triggerStockout = () => {
    setSelectedClientId(HERO_CLIENT_ID);
    setScenarioId("stockout_replan");
    setFeedOpen(true);
    setView("clients");
  };

  const watchFeed = () => {
    setFeedOpen(true);
    if (activeEvents.length > 0) replay.play();
  };
  const backToHappyPath = () => setScenarioId("happy_path");

  return (
    <>
    <div className="flex min-h-dvh flex-col gap-3 bg-background p-3 text-foreground print:hidden sm:p-4 xl:h-dvh xl:overflow-hidden">
      <header className="sticky top-0 z-30 -mx-3 -mt-3 flex min-h-16 flex-wrap items-center gap-3 border-b border-[#e5e5e0] bg-white/95 px-4 py-2 backdrop-blur sm:-mx-4 sm:-mt-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <HeartPulse size={21} strokeWidth={2.5} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-extrabold leading-tight text-black">
              RxKitchen
            </h1>
            <p className="truncate text-xs text-[#62625b]">
              Planning {totalMeals.toLocaleString()} clinically-safe meals for{" "}
              {clients.length} clients · Today: Monday, July 20, 2026
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => setHelpOpen(true)}
            title="How RxKitchen works"
            aria-label="How RxKitchen works"
            className="brutal-btn inline-flex size-10 items-center justify-center bg-[#f6f6f3] text-black"
          >
            <HelpCircle size={17} aria-hidden />
          </button>
          <button
            onClick={() => setDonationSimOpen(true)}
            title="Drop off a new donation and watch the triage agent classify it"
            className="brutal-btn inline-flex items-center gap-2 bg-[#f6f6f3] px-4 text-xs font-bold text-black"
          >
            <PackagePlus size={16} aria-hidden />
            <span className="hidden sm:inline">New donation</span>
          </button>
          {scenarioId === "stockout_replan" ? (
            <button
              onClick={backToHappyPath}
              className="brutal-btn inline-flex items-center gap-2 bg-[#e5e5e0] px-4 text-xs font-bold"
            >
              <RotateCcw size={16} aria-hidden />
              Back to plan
            </button>
          ) : (
            <button
              onClick={triggerStockout}
              disabled={!heroProcessed}
              title={
                heroProcessed
                  ? "Mark a meal out of stock and watch the plan repair itself"
                  : "Run Rosa's referral through the agents first"
              }
              className="brutal-btn inline-flex items-center gap-2 bg-primary px-4 text-xs font-bold text-white"
            >
              <TriangleAlert size={16} aria-hidden />
              <span className="hidden sm:inline">Simulate stockout</span>
            </button>
          )}
        </div>
      </header>

      <MetricsBanner effectiveAllocations={activeAllocations} />

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["week", "This week's cooking", ChefHat],
            ["clients", "Client plans", Users],
          ] as [View, string, typeof ChefHat][]
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`brutal-btn inline-flex items-center gap-2 px-4 text-xs font-bold ${
              view === id ? "bg-black text-white" : "bg-white text-black"
            }`}
          >
            <Icon size={15} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {view === "week" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-1 [&>*]:shrink-0">
          <ActionInbox
            violations={violations}
            totalServings={totalMeals}
            onReviewHero={() => selectClient(HERO_CLIENT_ID)}
            onOpenDonation={() => setDonationSimOpen(true)}
          />
          <BatchRunTicker />
          <WeeklyCookList effectiveAllocations={activeAllocations} />
          <SupplyProjection effectiveAllocations={activeAllocations} />
        </div>
      )}

      {view === "clients" && (
      <main
        className={`dashboard-grid grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 ${
          feedOpen
            ? "xl:grid-cols-[270px_minmax(380px,1fr)_minmax(380px,440px)]"
            : "xl:grid-cols-[270px_220px_minmax(0,1fr)]"
        }`}
      >
        <IntakeQueue
          clients={clients}
          selectedId={selectedClientId}
          heroApproved={Boolean(workflow.heroApprovedAt)}
          heldIds={overrides.holds}
          onSelect={selectClient}
        />
        {feedOpen ? (
          <ActivityFeed
            replay={replay}
            onHide={() => setFeedOpen(false)}
            scenarioTitle={
              isHero
                ? scenario.title
                : nonHeroRun
                  ? `How ${selectedClient?.name ?? "this client"}'s plan was built — run the agents`
                  : "Loading this client's pipeline run…"
            }
          />
        ) : (
          <section className="brutal-card flex flex-col items-center justify-center gap-4 bg-white p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#f6f6f3] text-[#62625b]">
              <Activity size={22} aria-hidden />
            </span>
            <p className="max-w-44 text-xs leading-relaxed text-[#62625b]">
              Every plan is built step by step by the agents — and you can
              watch.
            </p>
            <button
              onClick={watchFeed}
              className="brutal-btn inline-flex items-center gap-2 bg-primary px-4 text-xs font-bold text-white"
            >
              <Play size={15} fill="currentColor" aria-hidden />
              See the agents work
            </button>
          </section>
        )}
        {selectedClient ? (
          <ClientPlanCard
            client={selectedClient}
            allocation={selectedAllocation}
            runEvents={activeEvents}
            revealedMealIds={revealedMealIds}
            kitRevealed={kitRevealed}
            approval={
              isHero
                ? {
                    approvedAt: workflow.heroApprovedAt,
                    onApprove: () =>
                      setWorkflow({ heroApprovedAt: approvalStamp() }),
                  }
                : null
            }
            weekApprovedAt={workflow.weekApprovedAt}
            held={overrides.holds.includes(selectedClientId)}
            swappedDays={
              new Set(
                Object.keys(overrides.swaps)
                  .filter((k) => k.startsWith(`${selectedClientId}:`))
                  .map((k) => k.split(":")[1]),
              )
            }
          />
        ) : (
          <div className="brutal-card bg-white" />
        )}
      </main>
      )}

      <section
        className={`brutal-card shrink-0 overflow-hidden bg-white ${
          opsOpen ? "h-[min(26rem,70vh)] xl:h-64" : ""
        }`}
      >
        <div
          className={`flex min-h-14 flex-wrap items-center gap-2 bg-white px-3 py-2 ${
            opsOpen ? "border-b border-[#e5e5e0]" : ""
          }`}
        >
          <span className="px-1 text-xs font-semibold text-[#62625b]">
            Operations
          </span>
          {(
            [
              ["kitchen", "Kitchen", ChefHat],
              ["scale", "All clients", BarChart3],
            ] as [Tab, string, typeof ChefHat][]
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setOpsOpen(id !== tab || !opsOpen);
              }}
              className={`brutal-btn inline-flex items-center gap-2 px-3 text-xs font-bold ${
                opsOpen && tab === id
                  ? "bg-black text-white"
                  : "bg-[#f6f6f3] text-black"
              }`}
            >
              <Icon size={15} aria-hidden />
              {label}
            </button>
          ))}
          {opsOpen && (
            <button
              onClick={() => setOpsOpen(false)}
              title="Close operations panel"
              aria-label="Close operations panel"
              className="brutal-btn ml-auto inline-flex size-10 items-center justify-center bg-[#f6f6f3] text-black"
            >
              <X size={17} aria-hidden />
            </button>
          )}
        </div>
        {opsOpen && (
          <div className="h-[calc(100%-3.1rem)] overflow-y-auto">
            {tab === "kitchen" && (
              <KitchenPlan highlightBatchIds={highlightBatchIds} />
            )}
            {tab === "scale" && (
              <ScaleView
                effectiveAllocations={effectiveAllocations}
                selectedClientId={selectedClientId}
                onSelectClient={selectClient}
              />
            )}
          </div>
        )}
      </section>

      {showHelp && <HelpGuide onClose={closeHelp} />}

      {/* donation intake simulator (FR12) */}
      {donationSimOpen && (
        <DonationSimulator
          onClose={() => setDonationSimOpen(false)}
          onTriaged={() =>
            setWorkflow({ donationTriagedAt: approvalStamp() })
          }
        />
      )}
    </div>
    <KitchenPrintSheet effectiveAllocations={activeAllocations} />
    </>
  );
}
