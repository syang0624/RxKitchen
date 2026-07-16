"use client";

/**
 * Delivery route panel (FR9, P1): routes grouped by zone with time windows
 * and cold-chain status. Static, judge-inspectable — no live routing.
 */
import { useMemo } from "react";
import { clientById, delivery } from "@/lib/data";

export default function DeliveryPanel({
  selectedClientId,
  onSelectClient,
}: {
  selectedClientId: number | null;
  onSelectClient: (id: number) => void;
}) {
  const routesByZone = useMemo(() => {
    const groups = new Map<string, typeof delivery.batches>();
    for (const r of delivery.batches) {
      const list = groups.get(r.zone) ?? [];
      list.push(r);
      groups.set(r.zone, list);
    }
    return groups;
  }, []);

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {[...routesByZone.entries()].map(([zone, routes]) => {
        const zoneInfo = delivery.zones.find((z) => z.zone === zone);
        return (
          <div
            key={zone}
            className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3"
          >
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium text-zinc-100">{zone}</p>
              <span className="text-[11px] text-zinc-500">
                {zoneInfo?.depot_distance_mi} mi · cold-chain limit{" "}
                {zoneInfo?.cold_chain_limit_hours} h
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {routes.map((r) => {
                const containsSelected =
                  selectedClientId !== null &&
                  r.clients.includes(selectedClientId);
                return (
                  <div
                    key={r.route_id}
                    className={`rounded-md border p-2 ${
                      containsSelected
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-zinc-800"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <span className="font-mono text-zinc-300">
                        {r.route_id}
                      </span>
                      <span className="text-zinc-500">
                        {r.delivery_date} · {r.window} ·{" "}
                        {r.cold_chain_ok ? (
                          <span className="text-emerald-300">cold chain ✓</span>
                        ) : (
                          <span className="text-red-300">cold chain ✕</span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.clients.map((cid) => (
                        <button
                          key={cid}
                          onClick={() => onSelectClient(cid)}
                          title={clientById.get(cid)?.name ?? String(cid)}
                          className={`rounded px-1.5 py-px font-mono text-[10px] transition ${
                            cid === selectedClientId
                              ? "bg-blue-400 text-zinc-950"
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          }`}
                        >
                          {cid}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
