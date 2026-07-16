"use client";

/** Shared UI primitives: agent identity, badges, check pills. */
import type { AgentName } from "@/lib/types";

export const AGENT_META: Record<
  AgentName,
  { label: string; icon: string; text: string; bg: string; border: string }
> = {
  orchestrator: {
    label: "Orchestrator",
    icon: "🎛",
    text: "text-violet-300",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
  },
  intake: {
    label: "Intake Agent",
    icon: "📋",
    text: "text-sky-300",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
  },
  matching: {
    label: "Clinical Matching",
    icon: "🩺",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  kitchen: {
    label: "Kitchen Planning",
    icon: "🍳",
    text: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  donation: {
    label: "Donation Triage",
    icon: "📦",
    text: "text-teal-300",
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
  },
  delivery: {
    label: "Delivery Agent",
    icon: "🚚",
    text: "text-blue-300",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  fallback: {
    label: "Fallback Composer",
    icon: "🧺",
    text: "text-rose-300",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
};

export function AgentBadge({ agent }: { agent: AgentName }) {
  const meta = AGENT_META[agent];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.text} ${meta.bg} ${meta.border}`}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

export function CheckPill({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
        pass
          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/25"
          : "bg-red-500/15 text-red-300 border border-red-500/40"
      }`}
    >
      {pass ? "✓" : "✕"} {label}
    </span>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 ${className}`}
    >
      <header className="flex items-baseline justify-between gap-2 border-b border-zinc-800 px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-200">
          {title}
        </h2>
        {subtitle && <span className="text-xs text-zinc-500">{subtitle}</span>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
