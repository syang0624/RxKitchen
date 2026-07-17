"use client";

/**
 * Shared UI primitives (neobrutalist design system — STEVEN.md).
 * Agent identity chips, check pills, and the standard card container.
 */
import type { AgentName } from "@/lib/types";

export const AGENT_META: Record<
  AgentName,
  { label: string; icon: string; chip: string; edge: string }
> = {
  orchestrator: {
    label: "Orchestrator",
    icon: "🎛",
    chip: "bg-primary text-white",
    edge: "border-l-primary",
  },
  intake: {
    label: "Intake Agent",
    icon: "📋",
    chip: "bg-sky-300 text-black",
    edge: "border-l-sky-400",
  },
  matching: {
    label: "Clinical Matching",
    icon: "🩺",
    chip: "bg-secondary text-black",
    edge: "border-l-lime-500",
  },
  kitchen: {
    label: "Kitchen Planning",
    icon: "🍳",
    chip: "bg-amber-300 text-black",
    edge: "border-l-amber-400",
  },
  donation: {
    label: "Donation Triage",
    icon: "📦",
    chip: "bg-teal-300 text-black",
    edge: "border-l-teal-400",
  },
  delivery: {
    label: "Delivery Agent",
    icon: "🚚",
    chip: "bg-blue-300 text-black",
    edge: "border-l-blue-400",
  },
  fallback: {
    label: "Fallback Composer",
    icon: "🧺",
    chip: "bg-rose-300 text-black",
    edge: "border-l-rose-400",
  },
};

export function AgentBadge({ agent }: { agent: AgentName }) {
  const meta = AGENT_META[agent];
  return (
    <span
      className={`brutal-flat inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.chip}`}
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
      className={`brutal-flat inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold ${
        pass ? "bg-secondary text-black" : "bg-red-500 text-white"
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
      className={`brutal-card flex min-h-0 flex-col overflow-hidden bg-white ${className}`}
    >
      <header className="flex items-baseline justify-between gap-2 border-b-2 border-black bg-background px-4 py-2.5">
        <h2 className="font-heading text-xs font-extrabold uppercase tracking-wide">
          {title}
        </h2>
        {subtitle && (
          <span className="font-mono text-[11px] text-black/60">{subtitle}</span>
        )}
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
