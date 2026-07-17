"use client";

/**
 * /presentation — the 3-slide pitch deck, in the product itself.
 * Navigate with ←/→, space, or the on-screen arrows. Slide 1's numbers are
 * computed live from the same dataset the app runs on, so the deck can never
 * drift from the product. Visit photos: drop files at
 * public/pitch/visit-1.jpg … visit-4.jpg and they appear on slide 2.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  HeartPulse,
  PackageSearch,
  Stethoscope,
} from "lucide-react";
import {
  allocations,
  clientById,
  clients,
  donations,
  groceryById,
  mealById,
} from "@/lib/data";
import { computeMetrics } from "@/lib/validators";

function PhotoSlot({ index }: { index: number }) {
  // Photos are shown whole (object-contain, letterboxed) — never cropped.
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");
  return (
    <figure
      className={`relative grid place-items-center overflow-hidden rounded-2xl ${
        status === "ok"
          ? "border border-[#e5e5e0] bg-white"
          : "border border-dashed border-[#dadad3] bg-[#f0efe9]"
      }`}
    >
      {status !== "missing" && (
        // eslint-disable-next-line @next/next/no-img-element -- user-dropped file of unknown size
        <img
          src={`/pitch/visit-${index}.jpg`}
          alt={`Project Open Hand visit photo ${index}`}
          onLoad={() => setStatus("ok")}
          onError={() => setStatus("missing")}
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}
      {status === "missing" && (
        <figcaption className="p-4 text-center text-xs leading-relaxed text-[#62625b]">
          Drop your photo at
          <br />
          <code className="font-mono text-[11px] text-[#211922]">
            public/pitch/visit-{index}.jpg
          </code>
        </figcaption>
      )}
    </figure>
  );
}

function Brand({ tagline }: { tagline: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-full bg-[#e60023] text-white">
        <HeartPulse size={20} strokeWidth={2.5} aria-hidden />
      </span>
      <p className="text-sm">
        <span className="font-bold text-[#211922]">RxKitchen</span>{" "}
        <span className="text-[#62625b]">· {tagline}</span>
      </p>
    </div>
  );
}

const STEPS = [
  { icon: Building2, title: "Referral", body: "HL7-style discharge from the hospital" },
  { icon: ClipboardList, title: "Intake Agent", body: "structures diets, allergies, hard limits" },
  { icon: Stethoscope, title: "Clinical Matching", body: "hard checks exclude — never “score down”" },
  { icon: ChefHat, title: "Kitchen Planning", body: "daily menus + fresh batches from real demand" },
  { icon: PackageSearch, title: "Donation Triage", body: "food-safety gate routes arrivals to recipes" },
  { icon: CheckCircle2, title: "CNO decides", body: "approve, swap, substitute — gated on zero issues" },
];

export default function PresentationPage() {
  const [slide, setSlide] = useState(0);
  const total = 4;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setSlide((s) => (s + 1) % total);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setSlide((s) => (s + total - 1) % total);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Live numbers — same data, same validators as the product.
  const stats = useMemo(() => {
    const m = computeMetrics(allocations, clientById, mealById, groceryById, donations);
    const servings = allocations.reduce(
      (s, a) => s + a.items.reduce((n, it) => n + it.qty, 0),
      0,
    );
    return {
      violations: m.clinicalViolations,
      clients: clients.length,
      servings,
      matchedPct: Math.round(m.fullyCompliantPct),
      donationPct: Math.round(m.donationUtilizationPct),
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-[#fbfbf9] text-[#211922]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8 sm:px-10">
        {/* slide 1 — problem & product */}
        {slide === 0 && (
          <section className="flex flex-1 flex-col">
            <Brand tagline="agentic clinical meal planning · built for Project Open Hand" />
            <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#e60023]">
              The problem
            </p>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              A prescription on one side.
              <br />A food bank on the other.
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-[#62625b] sm:text-base">
              Hospitals discharge clients with strict clinical diets — diabetes,
              cardiovascular, renal, allergies. Medically-tailored-meal kitchens
              must match them against{" "}
              <b className="text-[#211922]">
                unpredictable donations, finite stock, and limited kitchen
                capacity
              </b>
              . Today a dietitian reconciles this by hand, for hours, per
              referral.
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#62625b] sm:text-base">
              <b className="text-[#211922]">RxKitchen:</b> a multi-agent AI
              drafts the entire week — menus, batches, grocery kits — and the
              Chief Nutrition Officer reviews, approves, and edits: one click
              substitutes a recipe for a whole group, safety-checked per person.{" "}
              <b className="text-[#211922]">
                Agents propose. She decides. Nothing unsafe ships.
              </b>
            </p>
            <div className="mt-auto grid grid-cols-2 gap-3 pt-8 sm:grid-cols-5">
              {[
                [String(stats.violations), "clinical safety issues — re-verified live in the browser", true],
                [String(stats.clients), "clients planned, referral to doorstep", false],
                [stats.servings.toLocaleString(), "meals scheduled this week", false],
                [`${stats.matchedPct}%`, "matched to fully compliant meals", false],
                [`${stats.donationPct}%`, "of donations routed into recipes & pantry", false],
              ].map(([value, label, good]) => (
                <div
                  key={label as string}
                  className={`rounded-2xl border p-4 ${
                    good
                      ? "border-[#bfe6d0] bg-[#eafaf1]"
                      : "border-[#dadad3] bg-white"
                  }`}
                >
                  <p
                    className={`font-mono text-2xl font-bold tabular-nums ${
                      good ? "text-[#103c25]" : "text-[#211922]"
                    }`}
                  >
                    {value}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-[#62625b]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* slide 2 — problem definition: POH + the nutritionist */}
        {slide === 1 && (
          <section className="flex flex-1 flex-col">
            <Brand tagline="problem definition" />
            <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#e60023]">
              Who has this problem
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              We&apos;re solving it for Project Open Hand —
              <br />
              for nutritionists like Katie
            </h1>
            <div className="mt-6 grid flex-1 gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#dadad3] bg-white p-5">
                <h2 className="text-sm font-bold">The problem, precisely</h2>
                <ul className="mt-2 space-y-2.5 text-xs leading-relaxed text-[#62625b] sm:text-sm">
                  <li>
                    • <b className="text-[#211922]">Project Open Hand</b> (San
                    Francisco) delivers medically tailored meals to clients
                    discharged with diabetes, cardiovascular and renal
                    conditions, and allergies.
                  </li>
                  <li>
                    • Every referral must be reconciled against{" "}
                    <b className="text-[#211922]">
                      diet prescriptions, today&apos;s stock, donated
                      ingredients, and kitchen capacity
                    </b>{" "}
                    — today that happens by hand, in spreadsheets, for hours
                    per referral.
                  </li>
                  <li>
                    • A missed allergen or sodium ceiling is a{" "}
                    <b className="text-[#211922]">clinical incident</b>, not a
                    typo — so everything bottlenecks on the nutrition team.
                  </li>
                  <li>
                    • Scale breaks the manual process:{" "}
                    <b className="text-[#211922]">
                      150 clients × 7 meals × 5 hard constraints
                    </b>{" "}
                    is thousands of safety decisions every week.
                  </li>
                </ul>
              </div>
              <div className="rounded-2xl border border-[#a8dcc0] bg-[#c7f0da] p-5 text-[#103c25]">
                <h2 className="text-sm font-bold">Who we&apos;re building for</h2>
                <p className="mt-2 text-sm font-bold">
                  Katie Jackson · Chief Nutrition Officer, Project Open Hand
                </p>
                <p className="text-xs">interviewed on-site · July 16, 2026</p>
                <ul className="mt-3 space-y-2 text-xs leading-relaxed sm:text-sm">
                  <li>
                    • Clinically accountable — she signs off on every meal that
                    ships.
                  </li>
                  <li>
                    • Plans for the whole kitchen: weekly menus, batches, and
                    donations — not one plate at a time.
                  </li>
                  <li>
                    • Not technical — needs plain language and one-glance
                    safety, never JSON or dashboards of raw data.
                  </li>
                  <li>
                    • Her definition of success:{" "}
                    <b>
                      nothing unsafe ships, nobody goes unfed, donations
                      don&apos;t go to waste.
                    </b>
                  </li>
                </ul>
                <p className="mt-3 border-t border-[#a8dcc0] pt-2.5 text-xs">
                  Solving it deeply for POH first — the same shape fits every
                  medically-tailored-meal org.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* slide 3 — Project Open Hand visit */}
        {slide === 2 && (
          <section className="flex flex-1 flex-col">
            <Brand tagline="field research" />
            <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#e60023]">
              We went to the source
            </p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight">
              Our visit to Project Open Hand
            </h1>
            <div className="mt-6 grid h-[min(52vh,540px)] grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <PhotoSlot key={i} index={i} />
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ["Kitchens cook menus, not plates.", "Bulk batches of a few recipes a day — never 150 bespoke meals.", "→ 3–5 recipes/day menu planner"],
                ["Donations are a lottery.", "What arrives is unpredictable; using it well is the margin that funds meals.", "→ triage gate + donation-to-recipe routing"],
                ["A human signs off on safety.", "The nutrition team is clinically accountable — automation can draft, not decide.", "→ approve-to-send workflow, gated on 0 issues"],
              ].map(([title, body, tag]) => (
                <div key={title} className="rounded-2xl border border-[#dadad3] bg-white p-4">
                  <p className="text-sm font-bold">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#62625b]">{body}</p>
                  <p className="mt-2 inline-block rounded-full bg-[#c7f0da] px-2.5 py-1 text-[11px] font-bold text-[#103c25]">
                    {tag}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* slide 4 — how it works */}
        {slide === 3 && (
          <section className="flex flex-1 flex-col">
            <Brand tagline="how it works" />
            <p className="mt-8 text-xs font-bold uppercase tracking-widest text-[#e60023]">
              Referral to doorstep, in minutes
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Specialist agents, one safety hierarchy, a human decision
            </h1>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {STEPS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-[#dadad3] bg-white p-3 text-center">
                  <Icon size={20} className="mx-auto text-[#211922]" aria-hidden />
                  <p className="mt-1.5 text-xs font-bold">{title}</p>
                  <p className="mt-1 text-[10px] leading-snug text-[#62625b]">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid flex-1 gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#dadad3] bg-white p-5">
                <h2 className="text-sm font-bold">Honest by construction</h2>
                <ul className="mt-2 space-y-2 text-xs leading-relaxed text-[#62625b] sm:text-sm">
                  <li>• <b className="text-[#211922]">Reasoning pre-computed offline</b> by Claude — zero live-inference risk on stage.</li>
                  <li>• <b className="text-[#211922]">Safety verified live:</b> thousands of constraint checks re-run in the browser; the “0” is computed, never asserted.</li>
                  <li>• <b className="text-[#211922]">Grounding-audited streams:</b> agents can’t cite a meal, number, or batch that isn’t in the data.</li>
                  <li>• <b className="text-[#211922]">The replay contract is the v2 API</b> — swap the replayer for live agents, keep the product.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-[#a8dcc0] bg-[#c7f0da] p-5 text-[#103c25]">
                <h2 className="text-sm font-bold">What you saw in the demo</h2>
                <ul className="mt-2 space-y-2 text-xs leading-relaxed sm:text-sm">
                  <li>• New referral → drafted, explained, approved.</li>
                  <li>• “Why this meal?” — every check in plain words.</li>
                  <li>• <b>Group substitution → one recipe swapped for ~100 clients at once, safety-checked per person.</b></li>
                  <li>• Stockout → agents re-plan; limits never relax.</li>
                  <li>• Donation drop-off → triaged into a batch.</li>
                  <li>• Next-week projection → concrete donation asks.</li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* footer / navigation */}
        <footer className="mt-6 flex items-center gap-3 border-t border-[#e5e5e0] pt-4 text-xs text-[#62625b]">
          <span>Steven &amp; Nori · hackathon POC · July 2026</span>
          <Link
            href="/"
            className="underline underline-offset-2 hover:text-[#211922]"
          >
            Open the product
          </Link>
          <span className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSlide((s) => (s + total - 1) % total)}
              aria-label="Previous slide"
              className="flex size-9 items-center justify-center rounded-full bg-white ring-1 ring-[#dadad3] transition-colors hover:bg-[#f6f6f3]"
            >
              <ArrowLeft size={15} aria-hidden />
            </button>
            <span className="font-mono tabular-nums">
              {slide + 1} / {total}
            </span>
            <button
              onClick={() => setSlide((s) => (s + 1) % total)}
              aria-label="Next slide"
              className="flex size-9 items-center justify-center rounded-full bg-white ring-1 ring-[#dadad3] transition-colors hover:bg-[#f6f6f3]"
            >
              <ArrowRight size={15} aria-hidden />
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}
