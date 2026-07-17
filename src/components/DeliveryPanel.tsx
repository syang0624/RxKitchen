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
          <div key={zone} className="brutal-box bg-white p-3">
            <div className="flex items-baseline justify-between">
              <p className="font-heading text-xs font-extrabold uppercase tracking-wide">
                {zone}
              </p>
              <span className="text-[11px] text-black/60">
                {zoneInfo?.depot_distance_mi} mi away · keep cold for max{" "}
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
                    className={`brutal-flat p-2 ${
                      containsSelected ? "bg-blue-100" : "bg-background"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <span className="font-mono font-bold">{r.route_id}</span>
                      <span className="text-black/60">
                        {r.delivery_date} · {r.window} ·{" "}
                        {r.cold_chain_ok ? (
                          <span className="font-bold text-black">
                            kept cold ✓
                          </span>
                        ) : (
                          <span className="font-bold text-red-600">
                            cold chain problem ✕
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.clients.map((cid) => (
                        <button
                          key={cid}
                          onClick={() => onSelectClient(cid)}
                          title={clientById.get(cid)?.name ?? String(cid)}
                          className={`brutal-flat px-1.5 py-px font-mono text-[10px] transition ${
                            cid === selectedClientId
                              ? "bg-primary font-bold text-white"
                              : "bg-white text-black hover:bg-secondary"
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
