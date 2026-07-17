"use client";

import type { ComponentType, ReactNode } from "react";
import {
  ChefHat,
  ClipboardList,
  PackageOpen,
  ShoppingBasket,
  SlidersHorizontal,
  Stethoscope,
  Truck,
  X,
  Check,
  type LucideProps,
} from "lucide-react";
import type { AgentName } from "@/lib/types";

export const AGENT_META: Record<
  AgentName,
  { label: string; icon: string; chip: string; edge: string }
> = {
  orchestrator: {
    label: "Orchestrator",
    icon: "controls",
    chip: "bg-[#f1f1ed] text-[#211922]",
    edge: "border-l-[#62625b]",
  },
  intake: {
    label: "Intake Agent",
    icon: "clipboard",
    chip: "bg-[#f6f6f3] text-[#33332e]",
    edge: "border-l-[#91918c]",
  },
  matching: {
    label: "Clinical Matching",
    icon: "stethoscope",
    chip: "bg-[#e8f5ed] text-[#103c25]",
    edge: "border-l-[#3f7656]",
  },
  kitchen: {
    label: "Kitchen Planning",
    icon: "chef-hat",
    chip: "bg-[#f4f0e8] text-[#3c3932]",
    edge: "border-l-[#a59d8e]",
  },
  donation: {
    label: "Donation Triage",
    icon: "package",
    chip: "bg-[#eeeeea] text-[#33332e]",
    edge: "border-l-[#77776f]",
  },
  delivery: {
    label: "Pickup Coordinator",
    icon: "truck",
    chip: "bg-[#f3f3ef] text-[#262622]",
    edge: "border-l-[#b1b1aa]",
  },
  fallback: {
    label: "Fallback Composer",
    icon: "basket",
    chip: "bg-[#f7eeee] text-[#651218]",
    edge: "border-l-[#e60023]",
  },
};

const AGENT_ICONS: Record<AgentName, ComponentType<LucideProps>> = {
  orchestrator: SlidersHorizontal,
  intake: ClipboardList,
  matching: Stethoscope,
  kitchen: ChefHat,
  donation: PackageOpen,
  delivery: Truck,
  fallback: ShoppingBasket,
};

export function AgentBadge({ agent }: { agent: AgentName }) {
  const meta = AGENT_META[agent];
  const Icon = AGENT_ICONS[agent];

  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${meta.chip}`}
    >
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={2} />
      {meta.label}
    </span>
  );
}

export function CheckPill({ pass, label }: { pass: boolean; label: string }) {
  const Icon = pass ? Check : X;

  return (
    <span
      title={label}
      className={`inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${
        pass
          ? "border-[#b9ddc7] bg-[#e8f5ed] text-[#103c25]"
          : "border-[#efc6cb] bg-[#fff1f2] text-[#9e0a0a]"
      }`}
    >
      <Icon aria-hidden="true" className="size-3" strokeWidth={2.5} />
      {label}
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
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#dadad3] bg-white ${className}`}
    >
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[#e5e5e0] bg-[#fbfbf9] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold leading-5 text-[#211922]">
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs leading-5 text-[#62625b]">{subtitle}</span>
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
