"use client";

/**
 * The CNO's action inbox — the workflow entry point on the landing view.
 * Three real decisions await her this morning: review the new referral,
 * approve the weekly menu (gated on zero safety issues), and triage the
 * donation that just arrived. Done items clear; everything persists.
 */
import { CheckCircle2, ClipboardCheck, PackagePlus, UserPlus } from "lucide-react";
import { clientById, donationScenario, donationById, HERO_CLIENT_ID } from "@/lib/data";
import {
  approvalStamp,
  resetWorkflow,
  setWorkflow,
  useWorkflow,
} from "@/lib/workflow";
import { resetOverrides } from "@/lib/overrides";

function Row({
  icon,
  title,
  detail,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  action: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f6f6f3] text-[#211922]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#211922]">{title}</p>
        <p className="text-xs text-[#62625b]">{detail}</p>
      </div>
      <span className="shrink-0">{action}</span>
    </li>
  );
}

export default function ActionInbox({
  violations,
  totalServings,
  onReviewHero,
  onOpenDonation,
}: {
  violations: number;
  totalServings: number;
  onReviewHero: () => void;
  onOpenDonation: () => void;
}) {
  const wf = useWorkflow();
  const hero = clientById.get(HERO_CLIENT_ID);
  const donation = donationById.get(donationScenario.donation_id ?? "");
  const openCount = [wf.heroApprovedAt, wf.weekApprovedAt, wf.donationTriagedAt].filter(
    (v) => !v,
  ).length;

  if (openCount === 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-[#bfe6d0] bg-[#eafaf1] px-4 py-3 text-sm sm:px-5">
        <span className="flex items-center gap-2 font-semibold text-[#103c25]">
          <CheckCircle2 size={17} aria-hidden />
          All caught up
        </span>
        <span className="text-xs text-[#3f6b52]">
          Menu approved {wf.weekApprovedAt} · {hero?.name.split(" ")[0]}&apos;s plan
          approved {wf.heroApprovedAt} · donation triaged {wf.donationTriagedAt}
        </span>
        <button
          onClick={() => {
            resetWorkflow();
            resetOverrides();
          }}
          className="ml-auto text-xs font-semibold text-[#3f6b52] underline underline-offset-2 hover:text-[#103c25]"
        >
          Reset demo workflow
        </button>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dadad3] bg-white">
      <header className="flex items-center gap-2 border-b border-[#e5e5e0] bg-[#fbfbf9] px-4 py-2.5 sm:px-5">
        <h2 className="text-xs font-semibold text-[#211922]">
          Needs your attention
        </h2>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e60023] px-1.5 text-[11px] font-bold text-white">
          {openCount}
        </span>
      </header>
      <ul className="divide-y divide-[#f0f0ec]">
        {!wf.heroApprovedAt && hero && (
          <Row
            icon={<UserPlus size={17} aria-hidden />}
            title={`New referral: ${hero.name}`}
            detail={`Arrived this morning from ${hero.referring_hospital}. The agents drafted her weekly plan — review the safety checks and approve it.`}
            action={
              <button
                onClick={onReviewHero}
                className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-[#e60023] px-4 text-xs font-bold text-white transition-colors hover:bg-[#cc001f]"
              >
                Review her plan
              </button>
            }
          />
        )}
        {!wf.weekApprovedAt && (
          <Row
            icon={<ClipboardCheck size={17} aria-hidden />}
            title="This week's menu is drafted"
            detail={
              violations === 0
                ? `${totalServings.toLocaleString()} servings across 150 clients, every safety check passing. Approving sends the cook list to the kitchen.`
                : `${violations} safety issue(s) found — the menu cannot be approved until they are resolved.`
            }
            action={
              <button
                onClick={() => setWorkflow({ weekApprovedAt: approvalStamp() })}
                disabled={violations > 0}
                className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-[#0f7a41] px-4 text-xs font-bold text-white transition-colors hover:bg-[#0c6335] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCircle2 size={15} aria-hidden />
                Approve & send to kitchen
              </button>
            }
          />
        )}
        {!wf.donationTriagedAt && donation && (
          <Row
            icon={<PackagePlus size={17} aria-hidden />}
            title={`Donation arrived: ${donation.items.map((i) => i.name).join(", ")}`}
            detail={`Dropped off by ${donation.donor} this morning. Run it through the food-safety gate and route it.`}
            action={
              <button
                onClick={onOpenDonation}
                className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-[#f6f6f3] px-4 text-xs font-bold text-black transition-colors hover:bg-[#e5e5e0]"
              >
                Triage it
              </button>
            }
          />
        )}
      </ul>
    </section>
  );
}
