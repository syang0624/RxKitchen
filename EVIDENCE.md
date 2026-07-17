# Why RxKitchen Is Strong: Evidence and Numbers

A research-backed case for the product, built for the hackathon pitch. Every number below has a public source (linked at the bottom); the ones worth putting on a slide are **bolded**.

---

## 1. The problem is enormous and measurable

- The U.S. spends roughly **$1.1 trillion per year** treating chronic, diet-related disease — about equal to everything Americans spend on food itself. ([Rockefeller Foundation](https://www.rockefellerfoundation.org/perspective/food-is-medicine-enhances-health-while-slashing-health-care-costs/))
- Meanwhile the supply side is drowning in waste: **70 million tons of surplus food in 2024 — 29% of the entire U.S. food supply**, worth **$380 billion**. About **85% of that surplus is wasted**, and **under 13% of donatable food is actually donated**. ([ReFED 2026 U.S. Food Waste Report](https://refed.org/food-waste/refed-us-food-waste-report-2026/))

RxKitchen sits exactly at this intersection: clinical need on one side, chaotic surplus on the other, and no software today that reconciles them under hard medical constraints.

## 2. Medically tailored meals demonstrably work — this is not a speculative intervention

- **Nature Medicine (2026), Massachusetts Medicaid:** MTM recipients had **31% fewer hospitalizations** and **20% fewer ED visits**; per-person healthcare costs fell **$3,433** over ~6 months — **offsetting 98% of the meals' cost**. (1,866 recipients vs. 1,372 comparators, 11 health systems.) ([Nature Medicine](https://www.nature.com/articles/s41591-026-04407-5), [Tufts Now](https://now.tufts.edu/2026/06/02/medically-tailored-meals-produce-better-health-and-lower-costs))
- **JAMA Internal Medicine (2019), Berkowitz et al. / Community Servings:** MTM participation associated with fewer inpatient and nursing-home admissions and a **16% reduction in average monthly medical costs** ($3,838 vs. $4,591). ([Community Servings](https://www.servings.org/food-health-policy/medically-tailored-meals-healthcare-utilization-study/))
- **JAMA Network Open (2022), national simulation (Tufts):** universal insurance coverage of MTMs would avert **~1.6 million hospitalizations** and produce **$13.6 billion in net savings in year one** — **$185 billion over 10 years**. ([Tufts Now](https://now.tufts.edu/2022/10/17/medically-tailored-meals-could-save-us-nearly-136-billion-year), [JAMA Network Open via PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9577678/))

The pitch line: *the clinical evidence for MTMs is settled; the unsolved problem is operational throughput. RxKitchen attacks the throughput.*

## 3. Policy tailwind: payers are starting to pay for this

- **16 states** (CA, CO, DE, HI, IL, ME, MA, NV, NJ, NM, NY, NC, OR, PA, RI, WA) have approved or pending **Medicaid Section 1115 waivers covering nutrition interventions including medically tailored meals**. ([KFF waiver tracker](https://www.kff.org/medicaid/medicaid-waiver-tracker-approved-and-pending-section-1115-waivers-by-state/))
- California's CalAIM already reimburses MTMs as a Community Support — Project Open Hand is a CalAIM provider, meaning a real revenue path exists for exactly the workflow RxKitchen automates.
- Honest caveat for Q&A: federal HRSN guidance was rescinded in March 2025 and CMS now reviews these waivers case-by-case — existing approvals stand, but the policy environment is in flux. Being able to say this unprompted signals the team knows the terrain. ([McDermott](https://www.mcdermottlaw.com/insights/food-as-medicine-a-deep-dive-into-reimbursement/))
- Market framing: "Food as Medicine" market estimates range from ~$26.5B (2025) growing to $66B+ by 2033 depending on definition. ([DataM Intelligence](https://www.datamintelligence.com/research-report/food-as-a-medicine-market), [openPR](https://www.openpr.com/news/4501700/food-as-a-medicine-market-set-to-reach-usd-66-4-billion-by-2033))

## 4. The bottleneck is human labor — and it's getting worse

- Dietetics has a **~44% workforce gap**; new-graduate entries dropped **32%** in recent years (4,147 new RDs in 2022 vs. a projected need of 5,600/yr), while demand grows 6% per decade. Inpatient clinical dietitians fell from 38% to 28% of the registry (≈11,000 people) in just three years. ([Sodexo](https://us.sodexo.com/inspired-thinking/healthcare/blogs/dietetics-workforce-solutions), [BLS](https://www.bls.gov/ooh/healthcare/dietitians-and-nutritionists.htm), [Today's Dietitian](https://www.todaysdietitian.com/newarchives/0224p14.shtml))
- The MTM sector is small relative to need: one national survey found just **26 Food is Medicine Coalition organizations delivering ~4 million meal-equivalents** — against a modeled eligible population in the millions. Scaling can't come from hiring; it has to come from tooling. ([FIMC](https://fimcoalition.org/))
- **Project Open Hand itself** (the design partner persona): **over 1 million meals to 14,500+ clients in FY2024**, **~2,500 meals/day**, groceries to 200+ clients/day; its Wellness Program alone served 715,000+ meals to 3,800 clients. Every one of those clinical clients requires the manual reconciliation RxKitchen automates. ([Project Open Hand](https://www.openhand.org/), [Food Is Medicine at POH](https://www.openhand.org/about-us/food-is-medicine))

## 5. Why this product, specifically

1. **Safety is architecturally guaranteed, not model-hoped.** The constraint hierarchy (allergens/sodium/carbs are hard filters, never "scored down") plus live client-side validators means the headline metric — **0 clinical violations across 150 clients** — is computed from data in front of the judges, not asserted. Most AI-in-healthcare demos cannot make that claim inspectable.
2. **It's a genuinely multi-agent problem.** Intake parsing, clinical matching, kitchen capacity planning, donation triage, and routing are distinct optimization problems with different data and different failure modes — the specialist-agent decomposition is motivated by the domain, not by fashion.
3. **It closes the loop nobody else closes.** Meal-planning apps ignore inventory; food-bank software ignores clinical constraints; hospital discharge tools stop at the referral. RxKitchen connects referral → allocation → production → donation utilization → delivery in one pipeline.
4. **Double impact function.** Every donation routed into a compliant meal simultaneously reduces the 85%-wasted surplus stream and substitutes for purchased food — the demo's **78% donation utilization vs. the <13% national donation rate** is a stark, defensible contrast.
5. **The demo architecture is the production architecture.** The pre-generated `agent_runs` event schema is the v2 API contract; swapping replay for live inference is an implementation change, not a redesign.

## 6. Numbers for the pitch deck (cheat sheet)

| Claim | Number | Source |
|---|---|---|
| Diet-related disease cost | $1.1T/yr | Rockefeller Foundation |
| U.S. surplus food | 70M tons, 29% of supply, $380B | ReFED 2026 |
| Donatable food actually donated | <13% | ReFED |
| MTM hospitalization reduction | −31% (Medicaid, 2026) / −49% (2019) | Nature Medicine / JAMA IM |
| MTM cost savings | $3,433/person/6mo; 98% cost offset | Nature Medicine 2026 |
| National MTM savings potential | $13.6B/yr net, 1.6M hospitalizations averted | JAMA Netw Open 2022 |
| States with MTM Medicaid waivers | 16 | KFF |
| Dietitian workforce gap | ~44%; −32% new grads | Sodexo / CDR |
| Project Open Hand scale | 1M+ meals/yr, 14,500 clients, 2,500/day | openhand.org |
| RxKitchen demo | 0 violations · 94% compliant match · 78% donation utilization · 150 clients in minutes | live validators |

---

## 7. Making it stronger for the hackathon

Ordered by impact-per-hour:

1. **Add a counterfactual baseline ("naive mode").** Run the same 150 clients through a greedy matcher with no constraint hierarchy and show the violation count it produces (e.g., "naive matching: 23 violations; RxKitchen: 0"). Zero is only impressive next to a nonzero. This is a few hours of work on existing data and it transforms the headline metric.
2. **Let judges try to break it.** A "sabotage" control: toggle an allergen onto a matched meal, or edit a client's sodium ceiling, and watch the live validator flag the violation and the plan re-rank. This proves the validators are real, interactive, and not theater — the single strongest answer to "is this live?"
3. **Put the evidence numbers in the product, not just the pitch.** A small "impact" panel that converts the demo run into dollars using published figures: *150 clients × $3,433 avg. savings ≈ $515K in modeled 6-month healthcare savings; hours of dietitian time returned.* Cite sources on hover — judges reward calibrated claims.
4. **Instrument time-per-referral.** Show a literal stopwatch: "referral → complete doorstep plan: 42 seconds (manual baseline: ~2 hours)." Time saved is currently framed "narratively" in the PRD — make it a measured number on screen.
5. **Add one human-in-the-loop beat.** A single "dietitian approves the fallback grocery kit" interaction (one click) reframes the system from "AI replaces the dietitian" to "AI does the reconciliation, the clinician stays in command" — the framing healthcare judges want, and it aligns with the real CalAIM/production path.
6. **Name the revenue path in the pitch.** One slide: CalAIM Community Supports + 16 waiver states = payers already reimburse the outcome RxKitchen produces; the software makes each reimbursed referral ~free to process. That turns a nonprofit tool into a scalable business story.
7. **Pre-write the three hard Q&A answers:** (a) "Is this live?" — reasoning pre-computed, validation live, event schema is the v2 API; (b) "HIPAA?" — synthetic data now, HIPAA/FHIR is workstream #1; (c) "Why agents and not one optimizer?" — heterogeneous sub-problems, legibility, and independent failure isolation.
