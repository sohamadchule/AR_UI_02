# Akruti — Market Opportunity

**Date:** 2026-10-27
**Companion to:** `ar-competitor-business-research.md` (evidence) and
`ar-business-model.md` (pricing).

Every claim below is tagged. The distinction between what is **evidenced** and what is
**assumed** is the entire point of this document — the assumptions are where the business
lives or dies, and they are listed explicitly in §7 so they can be tested rather than
believed.


> **Correction notice (2026-10-27).** The technical readiness statements in this document
> were originally written against `C:\SohamAdchule\AR`, an earlier prototype audited by
> mistake. They have been corrected below against `AR_UI_02`, the real project. **The
> market, competitor and financial research is unaffected** — it was never repo-specific.
> Where this document previously said Akruti lacked dimension handling, the opposite is
> true: it is built, tested and working (`ar-architecture-audit.md` §2).

| Tag | Meaning |
| --- | ------- |
| **[E]** | Evidenced — traceable to a cited source. |
| **[A]** | Assumption — reasoning that has **not** been validated. Must be tested. |
| **[U]** | Unknown — looked for, not found. |

---

## 1. The market as the evidence actually describes it

**[E] Indian furniture is a large market that is overwhelmingly offline and unorganised.**

| Figure | Value | Source |
| ------ | ----- | ------ |
| Indian furniture market | US$23.12bn (2022) → US$32.7bn by 2026, 10.9% CAGR | TPCI, via [IBEF](https://www.ibef.org/blogs/the-indian-online-furniture-industry) |
| Alternative sizing | ₹66,000 Cr (FY23) → ₹1.20 lakh Cr (FY28) | 1Lattice, via IBEF |
| **Unorganised share of sales** | **80%** (year not stated) | IBEF |
| Online furniture | ₹16,000 Cr (~US$1.92bn) by 2025, 27% CAGR | 1Lattice, via IBEF |
| D2C furniture | 36% CAGR to US$17bn by 2030 | Invest India, via IBEF |

**[E] But the online segment's leader is small and shrinking.** Pepperfry Limited, FY
ending March 2025: **₹164.1 Cr** operating revenue, down **13.8%** from ₹190.3 Cr, net
loss **₹83.4 Cr** `[AGGREGATOR — verify against MCA]`.

> **[A] The inference that follows is the most consequential judgement in this document:**
> if the best-known online furniture retailer in India generates ~₹164 Cr and is
> contracting, then **"Indian online furniture retailers" is not a market large enough to
> build a SaaS business on.** There are not hundreds of them with software budgets.
>
> Akruti's buyer is therefore far more likely to be one of the **thousands of offline
> showrooms** inside that 80% unorganised segment — which is a completely different
> customer, with a different problem, a different budget, and a different sales motion.

This reframing is not a detail. It changes the product. See §5.

---

## 2. Which customer problem is genuinely underserved

### 2.1 What is *not* underserved

**[E] The 3D viewer is solved, free, and commoditised.** Google's `<model-viewer>` is
Apache-2.0, production-grade, and supports AR on both Android and iOS in roughly ten
lines of HTML. Akruti is itself built on it. Shopify bundles 3D/AR into a **₹1,994/month**
Basic plan in India.

> **No retailer will pay for a 3D viewer.** Any plan whose core deliverable is "we show
> your product in 3D" is selling something Google gives away.

**[E] Enterprise visualisation is well served — for enterprises.** 3D Cloud serves Lowe's,
Ashley and Macy's. Cylindo serves large furniture brands. They are expensive, they take
8–10 weeks to implement, and they are not trying to serve small shops.

### 2.2 What *is* underserved — three gaps, with evidence

**Gap 1 — No vendor serves a retailer with fewer than ~100 SKUs. [E]**
GlamAR's smallest published tier is **100 SKUs**. 3D Cloud quotes an **8–10 week**
implementation. Cylindo's own paying customer states that *"smaller, cheaper items like
accessories don't make financial sense to ingest."* A shop with 30 products to digitise
is below every vendor's floor.

**Gap 2 — The expensive, unsolved problem is 3D asset creation, not AR. [E]**
Professional furniture modelling runs **$40–80 (simple) to $170–260 (high complexity)**
per model, at $40–60/hour.

The arithmetic that kills every deal:

| Catalogue | At $50/model (≈₹4,200) | At $150/model (≈₹12,600) |
| --------- | ---------------------- | ------------------------ |
| 30 SKUs | ₹1.26 lakh | ₹3.78 lakh |
| 100 SKUs | ₹4.2 lakh | ₹12.6 lakh |
| 500 SKUs | **₹21 lakh** | **₹63 lakh** |

**[A]** An independent Indian furniture retailer will not spend ₹21 lakh to visualise a
catalogue. The software is almost free; **the content is unaffordable**. This is the
actual barrier, and `[E]` it is corroborated by Nextech3D.AI — a public company built
precisely to solve 3D content at scale — reporting **$2.13M of annual revenue (FY ending
31 Mar 2026)** with 91.2% gross margin, while its flagship products are now event-tech.
The margin was never the problem. Volume was.

**Gap 3 — Nobody is selling dimensional trust. [A]**
Every vendor sells *visualisation*. The evidenced customer pain is **fit**: size/space
mismatch is the **~58%** leading stated cause of furniture returns `[E]`, and each
furniture return costs **$55–108** `[E]` — 2–3× an apparel return.

Yet no vendor's marketing leads with "guaranteed correct dimensions." They lead with
photorealism. **[A]** There is room for a product whose claim is *"this is exactly the
size it will be, and we'll prove it"* rather than *"this looks beautiful."*

**And here Akruti is further ahead than it realises.** `resolveTrueScale` already makes
the catalogue authoritative over the file, reconciles the two, detects side-on authoring,
rescues wrong-unit exports, refuses implausible sizes, and labels the result
`verified` / `approximate` / `no-dimensions`. Verified by execution: it rescues a chair
authored **111 km wide** to a correct 78 cm (`ar-validation-results.md` §1.2).

No competitor researched here leads on dimensional honesty — they lead on photorealism.
Akruti has built the differentiator the evidence most supports. **What it has not done is
earn the right to claim it**, because six of nine catalogue models still render 14–85%
wrong and every iPhone visitor sees the uncorrected file
(`ar-product-model-audit.md` §1, `ar-bug-report.md` BUG-01).

---

## 3. Which problem is expensive enough to pay for

`[E]` Ranked by evidenced cost to the retailer:

| Problem | Evidenced cost | Would a retailer pay? |
| ------- | -------------- | --------------------- |
| **Size/space returns** | ~58% of furniture returns; $55–108 each; ~19–23% of online orders returned | **[A] Yes — if the saving is demonstrable in their own numbers** |
| **3D content production** | $40–260/model; ₹21 lakh for 500 SKUs | **[A] Yes — this is the cost they most want removed** |
| Enterprise AR software | 8–10 week implementation, "not the cheapest" | **[A] No — out of budget and out of scale** |
| 3D viewer | ₹0 (free) | **[E] No** |

**[A] The combination that a retailer would plausibly pay for is: cheap content + proven
fit.** Not AR. AR is the delivery mechanism.

**[U] Critical caveat.** All return economics above are **US** figures, from US online
furniture with free-return norms. **No Indian furniture return-rate or
reverse-logistics-cost data was located in this research.** Indian furniture retail is
largely offline and heavily cash-on-delivery, where the equivalent cost is *order
cancellation and refused delivery*, not a formal return. **Until an Indian number exists,
the ROI pitch cannot honestly be made to an Indian retailer.** This is validation task #1.

---

## 4. Are Indian independent retailers underserved? What actually supports that

**Evidence for [E]:**
- The unorganised segment is **80%** of Indian furniture sales (IBEF).
- No vendor publishes a tier below 100 SKUs (GlamAR).
- Implementation timelines of 2–4 weeks (GlamAR) to 8–10 weeks (3D Cloud) are
  incompatible with a small shop's attention span.
- All vendor pricing is quote-based and USD-denominated — a structural signal of
  enterprise targeting.
- Cylindo's own customer confirms per-SKU economics break down on low-value items.

**Evidence against / unknown [U]:**
- **No evidence was found that Indian independent furniture retailers want AR**, have
  budget for it, or have ever been offered it. Their absence from vendor customer lists is
  equally consistent with "underserved" and with "not a viable market."
- **[U]** No data on what share of Indian SMB furniture retailers even have a transactional
  website. Many sell via showroom, WhatsApp and Instagram — in which case *"integrates
  with your retailer website"* describes a thing the customer does not have.

> **The honest conclusion:** the evidence supports *"no one is serving them."* It does
> **not** support *"they are waiting to be served."* Those are different claims and only
> the second one is a business. Distinguishing them requires talking to retailers, not
> more desk research.

---

## 5. What Akruti could offer that is meaningfully different

Each candidate is assessed on cost, feasibility, defensibility and customer value.
**[A]** throughout unless marked otherwise.

| Differentiator | Value | Feasibility | Defensible? | Verdict |
| -------------- | ----- | ----------- | ----------- | ------- |
| **Verified dimensions with a visible provenance label** | **High** — addresses the 58% return cause; nobody else leads on it | **ALREADY BUILT** — `resolveTrueScale` + `verified/approximate` labelling, tested 21/21. What remains is a catalogue that passes it and an upload gate | Weakly — copyable, but it is a *positioning* moat and requires discipline rivals lack | **Done in code. Now earn the claim: fix BUG-01 and replace the 6 wrong models.** |
| **Affordable, fast onboarding (days not weeks)** | **High** — directly beats 2–4 and 8–10 week rivals | **High** — mostly process | Low technically, high operationally | **Build** |
| **Low-SKU entry (10–50 products)** | **High** — everyone's floor is 100 | **High** — pricing decision | Not defensible, but rivals *won't* follow (it breaks their economics) | **Build** |
| **Cheap photo→3D asset conversion** | **Very high** — removes the real barrier | **Low–Medium, and unproven.** Nothing in the repo does this; `docs/ARCHITECTURE.md` explicitly scopes generation *out* | Would be the strongest moat if solved | **Validate before promising.** Highest risk, highest reward |
| **QR-led, showroom-to-home flow** | **High** for the 80% offline segment | **High — already built.** Stable `/view/<id>` URLs and QR generation exist and work | Low | **Build. Already paid for.** |
| **Multi-product fit checking** | Medium | **ALREADY BUILT** — up to 12 pieces, SAT overlap, 0.6 m walkway / 0.35 m companion gaps, guided room measurement. Tested. | Low — but **no competitor researched here ships furniture-to-furniture collision warnings** | **Keep. Unexpectedly differentiating — once the sizes under it are right.** |
| **Analytics proving business value** | High for *retention* | Medium | Low | **Build at pilot** |
| **Room scanning / automatic layout** | Low near-term | **Low — plane detection is Developer Trial in Chrome** (`ar-technical-research.md` §2) | — | **Do not build. Do not promise.** |
| **Image-to-3D generation** | High | **[U] Unproven at required quality** | Would be strong | **Research only** |

### 5.1 The QR insight — the strategically most valuable thing in this repo

`[E]` The CMS architecture has one genuinely well-engineered property
(`ar-architecture-audit.md` §3.5): the QR code encodes **only** `/view/<product-id>`, and
the GLB sits behind an opaque, replaceable storage key. A printed QR code keeps working
forever, even when the model is replaced.

`[A]` Combined with the finding that **80% of Indian furniture sales are offline**, this
suggests the product Akruti has accidentally built is not "AR for furniture e-commerce."
It is:

> **A sticker on a showroom sofa that a customer scans to see that exact sofa, at exactly
> the right size, in their own living room — before they decide.**

That reframing matters because:
- It fits the market that actually exists (offline showrooms), not the one that is
  shrinking (online retailers).
- It needs **no website integration** — the blocker for most small Indian retailers.
- It needs a **small catalogue** — the showroom's 20–40 hero pieces, not 500 SKUs.
- It makes the value legible to the shop owner: *"customers who scanned this bought more
  often, and cancelled less."*
- **It is a sales tool, not an e-commerce feature**, which is a budget line that offline
  retailers already recognise.

`[A]` This is a hypothesis, not a finding. It is validation task #2.

---

## 6. The minimum useful product

**[A]** What a small Indian furniture shop would plausibly pay for, with nothing extra:

1. **20–40 of their real products** in correctly-dimensioned 3D — produced by Akruti, not
   by the retailer.
2. **A printed QR code per showroom product** linking to a mobile page.
3. **Real-size AR placement that works** — anchored, floor-only, no silent rescaling.
   (That is `ar-roadmap.md` P0, and none of it currently works — `ar-bug-report.md`.)
4. **A visible dimension label** — "82.9 × 57.2 × 68.7 cm, manufacturer-verified."
5. **A one-page dashboard**: scans this week, successful placements, most-viewed product.
6. **A way to add a product in under 10 minutes.**

Explicitly **not** in the MVP: room scanning, fit verdicts, occlusion, layout suggestions,
configurators, image-to-3D. Every one of them is either technically unreliable today
(`ar-technical-research.md` §6) or unvalidated as a need.

### Features required to win the first 5–10 customers `[A]`

| Must have | Why |
| --------- | --- |
| Correct dimensions, provably | The only differentiator the evidence supports |
| Stable anchored placement | Without it the demo fails in the shop and there is no second meeting |
| Works on mid-range Android | `[E]` That is the fleet. BUG-06 means a failed session currently has **no fallback at all** |
| Akruti produces the models | `[E]` The retailer cannot and will not |
| Under ₹10,000/month all-in | `[E]` Anchored on Shopify India Basic at ₹1,994 and Grow at ₹7,447 |
| Live in under a week | `[E]` Rivals need 2–10 weeks |
| Something to show the owner | Retention depends on visible value |

---

## 7. What would make a retailer refuse to buy `[A]`

Ranked by likelihood. Each is a product requirement in disguise.

1. **"I have to make the 3D models myself."** — Instant no. Akruti must own asset
   production.
2. **"It doesn't work on my customer's phone."** — One failed demo ends the sale.
   `[E]` BUG-06 means a WebXR session failure currently leaves **no AR path at all**,
   on exactly the mid-range devices most likely to fail.
3. **"The sofa was the wrong size."** — Destroys the entire proposition in one
   demonstration. `[E]` BUG-02 makes this reachable in under a second of pinching.
4. **"I don't have a website."** — Fatal if the product assumes e-commerce integration.
   The QR-first design (§5.1) is the answer.
5. **"Prove it made me money."** — `[E]` No independent evidence exists; the vendor stats
   are correlational. Akruti must generate its own, from the pilot.
6. **"₹25,000 a month?"** — `[E]` Shopify's full Advanced plan is ₹30,164. An add-on
   cannot approach the cost of the whole store.
7. **"My products are made to order."** — `[A]` A real structural risk in India, where
   much furniture is custom carpentry. A fixed 3D catalogue may not match what is sold.
   **[U] Unquantified. Validation task #3.**

## What would make them keep paying `[A]`

- Visible usage: scan counts the owner can see going up.
- New products added routinely — the service stays alive rather than being a one-off.
- Salespeople using it in the shop, unprompted.
- A number that correlates with revenue — even a weak one, consistently reported.
- Switching cost: once 40 products are modelled and 40 QR stickers are printed, leaving
  means redoing all of it.

That last point is the only real retention moat in the MVP. **[A]** It is also why Akruti
should own the models and not hand over source files by default.

---

## 8. Recommended entry strategy

**[A] Target segment, in order:**

1. **Primary — single-location or small-chain furniture showrooms in one Indian city,
   with 20–60 display pieces and an owner who answers the phone.** Choose one city and
   saturate it; references travel locally and site visits must be cheap.
2. **Secondary — furniture manufacturers who already have CAD.** `[A]` Their asset cost
   is near zero because the geometry exists, which collapses Akruti's biggest cost. If the
   CAD→GLB pipeline works, this is the highest-margin segment and should be tested early.
3. **Avoid for now — large online retailers.** `[E]` The category leader does ₹164 Cr and
   is shrinking; they have in-house teams and long procurement.

**Entry sequence:**

| Stage | Action | Decision gate |
| ----- | ------ | ------------- |
| 0 | **Fix P0.** Dimensions, anchors, surface filtering, scale honesty, fallback. | `ar-test-plan.md` gates G1–G5 pass on 3 devices |
| 1 | **Talk to 15 retailers before building anything else.** Ask about returns, cancellations, customer indecision, what they pay for software. | Do ≥5 describe a size/fit problem unprompted? |
| 2 | **Model 20 products for 2 shops free.** Measure the true cost per model in hours and rupees. | Is cost/model under ₹2,500 at acceptable quality? |
| 3 | **4-week paid pilot** at a deliberately low price, with before/after measurement. | Does the owner renew without being persuaded? |
| 4 | Only then price properly and scale within the same city. | 5 paying customers retained 3 months |

**[A] The decision gate that matters is stage 2.** If a usable, dimensionally-verified
model cannot be produced for well under ₹2,500, the unit economics in
`ar-business-model.md` do not close and the business should be reconsidered rather than
repriced.

---

## 9. Assumptions register — test these, do not believe them

| # | Assumption | How to test | If false |
| - | ---------- | ----------- | -------- |
| A1 | Indian furniture retailers have a size/fit problem worth money | 15 interviews; ask for their return/cancellation rate in their own words | The ROI pitch collapses; reposition as a sales/marketing tool |
| A2 | The QR showroom-to-home flow is the right product | Put a QR on 5 sofas in one shop; count scans for 2 weeks | Rethink the channel entirely |
| A3 | Akruti can produce a verified model for under ₹2,500 | Actually produce 20 and record the hours | Unit economics fail; need image-to-3D or a different segment |
| A4 | A shop will pay ₹3,000–8,000/month | Offer it and see | Price down, or move to one-time project fees |
| A5 | Mid-range Android AR is reliable enough | `ar-test-plan.md` DT-01/03/05/10 on device B | The product does not work for the market it targets |
| A6 | Made-to-order furniture doesn't kill the catalogue model | Ask what share of sales is custom | Pivot to configurators, a much larger build |
| A7 | Retailers will supply accurate dimensions | Ask for a spec sheet in the first meeting | Akruti must measure physically — a real cost line |

`[A]` **A3 and A5 are the two that can be settled in two weeks and that would most change
the plan.** Do those first.

---

## 10. Honest summary

**What the evidence supports:**
- A real, quantified, expensive problem exists in furniture retail: size-related returns.
- Incumbent vendors genuinely do not serve retailers below ~100 SKUs.
- The 3D content cost, not the AR software, is the binding constraint.
- The viewer layer is free, so the business must be upstream of it.

**What the evidence does not support:**
- That AR causes measurable conversion lift (the headline stats are vendor-correlational).
- That Indian independent retailers want this or will pay for it — **no evidence either
  way was found.**
- That Akruti can produce 3D assets affordably — **still never attempted.** All nine
  catalogue models are Google Poly or FurniMesh demo assets
  (`ar-product-model-audit.md` §2). This remains the single untested assumption the
  business rests on.

**What has changed since the first draft of this document:** the technical
differentiator is no longer aspirational. Dimensional reconciliation, anchored placement,
floor/wall/tabletop classification, multi-object layout, overlap and walkway warnings and
a fit check are all built and verified. Akruti is not behind the market on engineering.
**It is behind on content** — which is precisely what its own
`docs/ar-market-comparison.txt` §4.1 concluded, and what the competitor research here
independently confirms is where every incumbent actually wins.

**The gap between those two lists is the whole risk.** It is closed by talking to fifteen
retailers and modelling twenty real products — not by writing more code.
