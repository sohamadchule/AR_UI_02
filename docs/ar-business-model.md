# Akruti — Business Model

**Date:** 2026-10-27

> **Every price in this document is a hypothesis, not a market price.** No Indian
> furniture retailer has been asked what they would pay. The numbers are anchored to
> evidenced comparables (§1) and to arithmetic, and they exist to be tested and revised —
> not quoted to anyone.

---

## 1. What the evidence says about price

Only two hard anchors exist. Everything else in this category is quote-based.

| Anchor | Figure | Source |
| ------ | ------ | ------ |
| **Shopify India** | Basic **₹1,994/mo** (₹1,499 annual) · Grow **₹7,447** (₹5,599) · Advanced **₹30,164** (₹22,680) · Plus from ₹1,75,000 · POS Pro ₹7,000/mo/location | [shopify.com/in/pricing](https://www.shopify.com/in/pricing) |
| **3D furniture modelling** | Simple **$40–80** (~2 h) · Medium **$100–150** (~15 h) · High **$170–260** (~40 h) · hourly $40–60 | [CAD Crowd](https://www.cadcrowd.com/blog/3d-furniture-modeling-services-costs-rates-and-pricing-for-companies/) |
| GlamAR structure | One-time setup + monthly by try-on volume; 100/300/500-SKU tiers; 2–4 week onboarding. **Prices not public.** | [glamar.io/pricing](https://www.glamar.io/pricing) |
| 3D Cloud | Enterprise contract, 8–10 week launch, *"not the cheapest option."* **Prices not public.** | [Capterra](https://www.capterra.com/p/246051/3D-Cloud/) |

**Two constraints follow directly.**

**Price ceiling.** Shopify Basic — an entire e-commerce platform — is ₹1,994/month in
India. Akruti is an *add-on*. An add-on priced above the platform it attaches to does not
sell. **Realistic range: ₹2,500–₹15,000/month**, with the mass of customers at the bottom.

**Cost floor.** US furniture modelling starts at ~$40/model. **No verified Indian
per-model rate was located in this research** — this is the single most important unknown
in the entire model, because it determines whether anything below works.

---

## 2. Six candidate models, assessed

| # | Model | Fit for Indian SMB furniture | Verdict |
| - | ----- | ---------------------------- | ------- |
| 1 | Flat monthly subscription | Simple, predictable, matches how SMBs buy software | **Core** |
| 2 | Tiers by catalogue size | Matches the real cost driver (models), and matches GlamAR's shape so buyers recognise it | **Core** |
| 3 | **One-time setup + monthly** | `[E]` GlamAR's actual structure. Recovers content cost up front — the thing that otherwise kills cash flow | **Core — essential, not optional** |
| 4 | Paid 3D model creation / catalogue conversion | **This is where the customer's real cost is.** Risk: it is a services business with services margins and services scaling | **Yes, but priced as a product, capped per month** |
| 5 | Premium AR / room-planning / analytics tiers | Analytics is the retention lever. Room planning is not reliably buildable (`ar-technical-research.md` §6) | **Analytics yes, room planning no** |
| 6 | Enterprise integrations / custom builds | Distraction at this stage; 3D Cloud already owns it | **No** |

**Not recommended: usage-based pricing by AR session.** It punishes the customer exactly
when the product is working, and an SMB cannot forecast the bill. GlamAR does it because
it sells to brands with marketing budgets; Akruti's buyer is a shop owner.

**Not recommended: revenue share.** It requires attribution Akruti cannot measure, and
retailers will not open their books to a new vendor.

---

## 3. Recommended model

> **One-time setup fee that pays for the initial 3D models, plus a modest monthly
> subscription tiered by catalogue size, plus a flat per-model fee for additions.**

This is the only shape that survives the two constraints in §1: the setup fee absorbs the
content cost (which is large, upfront and unavoidable), and the monthly stays below the
psychological ceiling set by Shopify.

### 3.1 Pricing hypothesis

| | **Starter** | **Growth** | **Pro** |
| --- | --- | --- | --- |
| Monthly | **₹2,999** | **₹6,999** | **₹14,999** |
| Products included | up to 25 | up to 75 | up to 200 |
| **One-time setup** | **₹25,000** | **₹60,000** | **₹1,40,000** |
| 3D models in setup | **10** | **25** | **60** |
| Additional model | ₹2,500 | ₹2,200 | ₹1,900 |
| QR kit | ✓ | ✓ | ✓ |
| Dimension verification | ✓ | ✓ | ✓ |
| Analytics | basic | + per-product | + export |
| Target | single showroom | small chain / online SMB | manufacturer or multi-store |

**Annual prepay: 2 months free** (≈17% discount). Worth more than the discount costs —
it fixes the cash-flow problem that setup-heavy models create.

**Pilot pricing (first 5–10 customers):** ₹1,000/month for 3 months, setup at cost.
The objective is evidence and references, not revenue. Say so openly to the customer; it
buys goodwill and honest feedback.

---

## 4. Unit economics

### 4.1 Assumptions, stated so they can be attacked

| Assumption | Value | Status |
| ---------- | ----- | ------ |
| Internal cost per verified 3D model | **₹2,000** | **UNVALIDATED — the critical number** |
| Hosting + CDN per retailer / month | ₹250 | Estimate |
| Support, early life | 1.5 h/month @ ₹500/h | Estimate |
| CAC (founder-led, in-city) | ₹12,000 | Estimate |
| Monthly churn | 2–4% by scenario | Assumption |

### 4.2 Per-customer margin

| Tier | Price/mo | COGS/mo | Gross/mo | GM% |
| ---- | -------- | ------- | -------- | --- |
| Starter | ₹2,999 | ₹1,000 | ₹1,999 | **67%** |
| Growth | ₹6,999 | ₹1,000 | ₹5,999 | **86%** |
| Pro | ₹14,999 | ₹1,000 | ₹13,999 | **93%** |

Setup: fee ₹25,000 − cost of 10 models at ₹2,000 = **₹5,000 contribution**. Thin by
design — it is a customer-acquisition subsidy, not a profit centre.

**CAC payback:** Starter **3.5 months**; Growth **1.2 months**. Healthy *if* ₹2,000/model
holds.

### 4.3 The sensitivity that decides everything

Catalogue production cost, at different per-model costs:

| SKUs | @ ₹1,200 | @ ₹2,000 | @ ₹4,200 *(≈$50)* | @ ₹12,600 *(≈$150)* |
| ---- | -------- | -------- | ----------------- | ------------------- |
| 20 | ₹24,000 | ₹40,000 | ₹84,000 | ₹2,52,000 |
| 50 | ₹60,000 | ₹1,00,000 | ₹2,10,000 | ₹6,30,000 |
| 100 | ₹1,20,000 | ₹2,00,000 | ₹4,20,000 | ₹12,60,000 |
| 500 | ₹6,00,000 | ₹10,00,000 | ₹21,00,000 | **₹63,00,000** |

Read the ₹4,200 column — that is simply **US rates converted**. At those rates a ₹25,000
setup fee buys **six models**, not ten, and the setup contribution goes **negative**.

> **The whole model turns on one number that has never been measured.** At ₹2,000/model it
> works. At ₹4,200 it is marginal. At ₹12,600 it is impossible at any price an Indian
> shop would pay.
>
> **Before anything else: produce 20 real models and record the actual hours.**
> (`ar-market-opportunity.md` §8, stage 2.)

---

## 5. Year-1 scenarios

Linear ramp to the stated customer count over 12 months, churn applied monthly.

### Conservative

8 customers by month 12 · ₹3,500 avg · 4% monthly churn

| | |
| --- | --- |
| Customers signed | 9.8 (8 retained) |
| Subscription revenue | ₹1,82,000 |
| Setup revenue | ₹2,44,000 |
| **Total Year-1 revenue** | **₹4,26,000** |
| **Gross profit** | **₹1,78,800** |
| Exit ARR | ₹3,36,000 |

*Reality:* a side project. Does not pay one salary. **This is the most likely outcome of a
first year** and should be planned for, not treated as failure.

### Moderate

25 customers · ₹5,500 avg · 3% churn

| | |
| --- | --- |
| Customers signed | 29.1 (25 retained) |
| Subscription revenue | ₹8,93,750 |
| Setup revenue | ₹7,28,125 |
| **Total Year-1 revenue** | **₹16,21,875** |
| **Gross profit** | **₹8,76,875** |
| Exit ARR | ₹16,50,000 |

*Reality:* funds one or two people. A viable small business, not yet a company.

### Optimistic

60 customers · ₹7,000 avg · 2% churn

| | |
| --- | --- |
| Customers signed | 66.6 (60 retained) |
| Subscription revenue | ₹27,30,000 |
| Setup revenue | ₹16,65,000 |
| **Total Year-1 revenue** | **₹43,95,000** |
| **Gross profit** | **₹26,73,000** |
| Exit ARR | ₹50,40,000 |

*Reality:* **even the optimistic case produces ₹26.7 lakh of gross profit** — roughly one
small team, before any marketing, office or founder salary.

### What this tells you

Selling ₹3,000–7,000/month software to independent retailers is a **volume business with a
long runway**, not a fast one. To reach **₹1 crore ARR** requires roughly:

- **152 customers** at ₹5,500/month, or
- **120 customers** at ₹7,000/month.

`[Assumption]` At founder-led, in-person, city-by-city sales, that is a **two-to-three-year
path**, not a twelve-month one.

**Three honest consequences:**

1. **Do not raise venture money against this model as stated.** The numbers do not support
   venture-scale growth at these price points with this cost structure.
2. **The leverage is not in price, it is in cost.** Halving the per-model cost does more
   for the business than doubling the subscription, because it is the setup fee — not the
   subscription — that gates how fast customers can be onboarded. This is why image-to-3D
   or a CAD pipeline matters strategically, and why `ar-market-opportunity.md` ranks
   manufacturers-with-CAD as the highest-margin segment.
3. **Or change the customer.** One furniture manufacturer with existing CAD and 300 SKUs
   is worth 20 showrooms, and costs almost nothing in content.

---

## 6. Cost structure to watch

| Cost | Scales with | Risk |
| ---- | ----------- | ---- |
| **3D model production** | Customers × SKUs | **Dominant. Linear. The business is this line.** |
| Dimension verification | SKUs | Hidden cost — if retailers supply wrong dimensions, Akruti must physically measure |
| Support | Customers | `[E]` Rivals need 2–10 weeks of onboarding; if Akruti's is similar, support eats the margin |
| Hosting/CDN | AR sessions × model size | Small, but `ar-product-model-audit.md` §5 shows 2 MB models — compress before scaling |
| Sales | Customers | Founder-led only works to ~30 customers |
| Device QA | Releases | `[E]` Android fragmentation is real; needs a permanent device fleet |

**The under-modelled risk:** `[E]` Cylindo's own customer states that *"smaller, cheaper
items like accessories don't make financial sense to ingest."* Akruti will hit exactly the
same wall. A ₹4,000 chair cannot justify a ₹2,000 model. **Only high-ASP hero products are
economic to digitise** — which constrains the catalogue to 20–40 items and is itself an
argument for the showroom-QR positioning rather than full-catalogue coverage.

---

## 7. How to prove value in a pilot

`[E]` The industry's conversion statistics are vendor-sourced and correlational
(`ar-competitor-business-research.md` §6). Akruti should not repeat them. It should
generate its own, modestly.

**Pilot design — 4 weeks, one showroom, 20 products:**

| | |
| --- | --- |
| **Treatment** | 10 products with QR + AR |
| **Control** | 10 comparable products, no QR |
| **Measure** | scans, successful placements, time in AR, enquiries, orders, cancellations |
| **Duration** | 4 weeks, plus 4 weeks of prior baseline from the retailer's own records |

**Report honestly**, including null results:

| Metric | Why |
| ------ | --- |
| Scan rate per product per week | Does anyone use it at all? |
| **Successful-placement rate** | Does the technology actually work in the field? |
| Enquiry rate: treatment vs control | The nearest thing to a conversion signal |
| Cancellation / return rate, both groups | The evidenced cost driver |
| Salesperson usage | The strongest leading indicator of renewal |

> A pilot with 20 products in one shop cannot produce a statistically significant
> conversion result, and claiming one would repeat the industry's bad habit. What it
> *can* produce is a directional signal and an honest conversation — which is what earns a
> second customer.

---

## 8. Decision summary

| Question | Recommendation |
| -------- | -------------- |
| Initial model | Setup fee + tiered monthly + per-model additions |
| Opening price | ₹2,999/mo Starter, ₹25,000 setup incl. 10 models |
| Pilot price | ₹1,000/mo for 3 months, setup at cost |
| Segment | Single-location Indian furniture showrooms, one city |
| Highest-margin segment to test early | Manufacturers with existing CAD |
| Hard gate before scaling | Verified cost per model **under ₹2,500** |
| Do not | Raise against these numbers; promise conversion lift; price per AR session |

**The one sentence that matters:** this business is viable at small scale and becomes
interesting only if the cost of producing a verified 3D model falls well below ₹2,000 —
so the next engineering investment with real commercial leverage is **the asset pipeline,
not the AR renderer.**
