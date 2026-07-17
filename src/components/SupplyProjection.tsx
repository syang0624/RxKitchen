"use client";

/**
 * Supply & projections (holistic view, part 2): where donations went, what the
 * pantry holds, and what next week demands — recipes to cook and ingredients
 * to source — so the CNO can plan donations against future need, not just
 * react to arrivals. All numbers computed live (src/lib/supply.ts).
 */
import { useMemo } from "react";
import { CalendarClock, PackageCheck, ShoppingBasket } from "lucide-react";
import type { Allocation } from "@/lib/types";
import { donationRoutes, pantrySummary, projectWeek } from "@/lib/supply";

function Card({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#dadad3] bg-white">
      <header className="flex items-center gap-2.5 border-b border-[#e5e5e0] bg-[#fbfbf9] px-4 py-2.5">
        <span className="text-[#211922]">{icon}</span>
        <h3 className="text-xs font-semibold text-[#211922]">{title}</h3>
        {subtitle && (
          <span className="ml-auto text-[11px] text-[#62625b]">{subtitle}</span>
        )}
      </header>
      <div className="min-h-0 flex-1 p-4">{children}</div>
    </section>
  );
}

export default function SupplyProjection({
  effectiveAllocations,
}: {
  effectiveAllocations: Allocation[];
}) {
  const routes = useMemo(() => donationRoutes(), []);
  const pantry = useMemo(() => pantrySummary(), []);
  const projection = useMemo(
    () => projectWeek(effectiveAllocations),
    [effectiveAllocations],
  );

  const acceptedItems = routes
    .filter((r) => r.accepted)
    .reduce((s, r) => s + r.donation.items.length, 0);
  const totalItems = routes.reduce((s, r) => s + r.donation.items.length, 0);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {/* donations → recipes */}
      <Card
        icon={<PackageCheck size={16} aria-hidden />}
        title="Donations → recipes"
        subtitle={`${Math.round((acceptedItems / totalItems) * 100)}% put to use`}
      >
        <ul className="space-y-2.5 text-xs">
          {routes.map(({ donation, batch, accepted }) => (
            <li key={donation.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`font-medium ${accepted ? "text-[#211922]" : "text-[#62625b] line-through"}`}>
                  {donation.items.map((i) => i.name).join(", ")}
                </p>
                <p className="text-[11px] text-[#62625b]">{donation.donor}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  !accepted
                    ? "bg-[#ffe1e1] text-[#8c1414]"
                    : batch
                      ? "bg-[#fdf3e2] text-[#6b4c11]"
                      : "bg-[#c7f0da] text-[#103c25]"
                }`}
                title={
                  batch
                    ? `Feeds batch ${batch.id}: ${batch.meal_name} (${batch.qty} servings)`
                    : undefined
                }
              >
                {!accepted
                  ? "✕ rejected at gate"
                  : batch
                    ? `→ ${batch.meal_name}`
                    : "→ pantry"}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* pantry inventory */}
      <Card
        icon={<ShoppingBasket size={16} aria-hidden />}
        title="Grocery pantry"
        subtitle={`${pantry.itemCount} items · ${pantry.totalUnits.toLocaleString()} units`}
      >
        <p className="text-[11px] leading-relaxed text-[#62625b]">
          Feeds the grocery kits and as-is distribution. Restock watchlist
          (lowest stock first):
        </p>
        <ul className="mt-2.5 space-y-2 text-xs">
          {pantry.lowest.map(({ name, stock }) => (
            <li key={name} className="flex items-center gap-2.5">
              <span className="min-w-0 flex-1 truncate font-medium text-[#211922]">
                {name}
              </span>
              <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-[#f0f0ec]">
                <span
                  className="block h-full rounded-full bg-[#e60023]"
                  style={{ width: `${Math.min(100, (stock / 220) * 100)}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-[#62625b]">
                {stock}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* next-week projection */}
      <Card
        icon={<CalendarClock size={16} aria-hidden />}
        title="Next week, if this menu repeats"
        subtitle={`${projection.batchesFedByDonations} of ${projection.totalBatches} batches donation-fed`}
      >
        <p className="text-sm text-[#211922]">
          <span className="font-mono text-xl font-bold tabular-nums">
            {projection.totalNextWeekCook.toLocaleString()}
          </span>{" "}
          <span className="text-xs text-[#62625b]">
            of {projection.totalDemand.toLocaleString()} servings must be cooked
            fresh — leftover stock covers the rest.
          </span>
        </p>
        <ul className="mt-2.5 space-y-1.5 text-xs">
          {projection.rows
            .filter((r) => r.nextWeekCook > 0)
            .slice(0, 5)
            .map((r) => (
              <li key={r.meal.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium text-[#211922]">
                  {r.meal.name}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#62625b]">
                  cook {r.nextWeekCook}×
                </span>
              </li>
            ))}
        </ul>
        {projection.ingredientNeeds.length > 0 && (
          <p className="mt-3 border-t border-[#e5e5e0] pt-2.5 text-[11px] leading-relaxed text-[#62625b]">
            <span className="font-semibold text-[#211922]">
              Donation asks to cover it:
            </span>{" "}
            {projection.ingredientNeeds
              .slice(0, 5)
              .map((i) => `${i.name} (~${i.servings} servings)`)
              .join(" · ")}
          </p>
        )}
      </Card>
    </div>
  );
}
