# Akruti — Roadmap (AR_UI_02)

**Date:** 2026-10-27

The engine is built and the pure logic is provably correct. What stands between this and
a product a retailer will pay for is **content and one plumbing defect** — not
architecture.

This roadmap deliberately agrees with, rather than replaces, the ordering in
`docs/ar-market-comparison.txt` §5. That document reached the right conclusion
independently; this adds the measurements and the gates.

---

## P0 — Blockers

Nothing ships to a retailer until these are done and `ar-test-plan.md` gates G1–G9 pass.

| # | Item | Fixes | Effort | Gate |
| - | ---- | ----- | ------ | ---- |
| **P0-1** | **Bake `trueScale` into the streamed GLB.** Rewrite the root node's `scale` (and `rotation` for `swapWidthDepth`) in the glTF JSON chunk when serving `/api/variants/:id/model`. | **BUG-01** | **M** | IT-07, BT-05, DT-07 |
| **P0-2** | **Replace the 6 approximate models** (`Lamp`, `DiningTable`, `Wardrobe`, `SideTable`, `Desk`, `Stool`) with models whose shape matches the listed product. | BUG-02 | **L** | UT-22, G4 |
| **P0-3** | **Compress `Sofa.glb` to under 5 MB.** KTX2/BasisU on the two 2048² textures first (3.91 MB of the 12.85), then Draco/meshopt, then decimate toward 20–40k triangles. | BUG-04 | M | G6, DT-08 |
| **P0-4** | **Asset quality gate at upload.** Run `resolveTrueScale` server-side; block >5% deviation, >5 MB, >150k triangles, `isPlaceable` false, or missing dimensions. Drop `MAX_GLB_MB` from 50 to 5. Show the AR-size preview before publish. | BUG-05 | M | G7 |
| **P0-5** | **Scene Viewer fallback** when `requestSession` rejects: re-enable `showArButton` and reword the message. | BUG-03, BUG-11 | **S** | DT-10, G5 |
| **P0-6** | **Adopt the 21 unit tests** (written and passing — `ar-test-plan.md` Layer 1). Add vitest. Add UT-22/23/24. | BUG-12 | **S** | CI green |
| **P0-7** | **Debug overlay** behind `?debug` (`ar-test-plan.md` has the component and wiring). | — | S | Device runs produce numbers |
| **P0-8** | **Run the device suite.** `docs/ar-changes.txt` A–G plus DT-01…DT-12, three Android phones and one iPhone. Record the numbers. | — | M | **G1, G2** |
| **P0-9** | **Attribution or replacement** for the CC-BY 3.0 Poly assets. Remove `db/seed/models/chair-damask.glb` (a Wayfair asset) from any live path. | BUG-08 | S | G8 |
| **P0-10** | **`ADMIN_TOKEN`** to a long random value; confirm `PROJECT_GUIDE.md` stays git-ignored. | — | S | G9 |

**Ordering.** P0-1 first: it is the only defect currently making the product *wrong*
rather than *approximate*, it affects every iPhone visitor, and fixing it also simplifies
the Android hot path. P0-6 and P0-7 next because they are hours of work and make
everything after them measurable. Then P0-5, P0-4, P0-3. P0-2 is the long pole — start
sourcing in parallel from day one. P0-8 last, because it should run against the fixed
build.

> **P0-2 is not a chore — it is the first real test of the business.** Akruti's pitch is
> that it can get a retailer's products into correctly-sized 3D. That capability has
> never been exercised in this repository: all nine models are Google Poly or FurniMesh
> demo assets. Producing six correct models, and **recording the hours and rupees each
> one took**, answers the question that decides the business model
> (`ar-business-model.md` §4.3).

---

## P1 — Next

Only after P0 gates pass on device.

| # | Item | Value | Note |
| - | ---- | ----- | ---- |
| P1-1 | `placement_surface` as a product column, defaulted from the current regex | High — placement stops depending on product naming | BUG-06 |
| P1-2 | Lighting estimation: consume the already-requested `light-estimation` | High for realism — the main reason AR furniture reads as "pasted on" | BUG-09. Measure against Google's documented caveats (too dark, abrupt updates, matte metals) before shipping |
| P1-3 | Lazy-load `model-viewer` only when WebXR is absent | Medium — 136 KB gzipped off the critical path on the primary target | BUG-10 |
| P1-4 | `visibilitychange` handling | Medium — battery, defined behaviour on return | BUG-07 |
| P1-5 | Load timeout + "continue in 3D" escape inside AR | Medium | DT-08 |
| P1-6 | Retailer analytics: AR opens, successful placements, time in AR, per product | **High — the retention lever and the pilot evidence** | `ar-business-model.md` §7 |
| P1-7 | Save and share a room layout | Medium — competitors have it (`ar-market-comparison.txt` §3) | |
| P1-8 | Add to cart from inside AR | Medium — Amazon and Wayfair have it | |

---

## P2 — Research-gated

Each needs an explicit go/no-go based on evidence.

| # | Item | Gate before any work |
| - | ---- | -------------------- |
| P2-1 | Depth-based occlusion | Does it hold frame rate on device B (mid-range)? Google reports >88% of ARCore devices support the Depth API as of May 2026 — the cost on a mid-range GPU is unmeasured |
| P2-2 | **Image/CAD → 3D asset generation** | **Highest commercial leverage on this roadmap.** Gate: can a usable, dimensionally-verified model be produced for **under ₹1,000**? |
| P2-3 | Material / colourway configuration beyond the current tint | Only after a real customer's catalogue needs variants |
| P2-4 | iPhone multi-product AR | Needs a native app or a commercial WebXR-on-iOS shim. Cost vs. reach decision, not a code task |

**P2-2 deserves emphasis.** `ar-business-model.md` §4.3 shows the business turns on cost
per model, not on subscription price. Halving content cost moves the company further than
any renderer improvement — and `ar-market-comparison.txt` §4.5 already names this as the
biggest business gap versus Avataar, GlamAR, Cylindo and 3D Cloud.

---

## P3 — Do not build

| Item | Why |
| ---- | --- |
| Automatic wall detection | Plane detection is **Developer Trial** in Chrome. Do not promise it to customers. |
| 3D room mesh / scan | Not exposed to WebXR Chrome; most Android phones have no LiDAR. The project already reached this conclusion and it is correct. |
| Semantic room understanding, door/window detection | Depends on the above |
| Automatic layout suggestions | Interesting; nobody asked |

The project's instinct here is right and should be held: **guided corner-tapping is the
realistic ceiling on Android web, and it is already built.**

---

## Sequencing against the business

| Phase | Weeks | Engineering | Commercial |
| ----- | ----- | ----------- | ---------- |
| **A** | 1 | P0-1, P0-6, P0-7, P0-10 | Begin sourcing replacement models; interview 15 retailers |
| **B** | 2–3 | P0-5, P0-4, P0-3 | **Produce the 6 replacement models. Record hours and cost each.** |
| **C** | 4 | P0-8 — full device suite, 3 Android + 1 iPhone | Gates G1–G9 |
| **D** | 5–8 | P1-6, P1-2, P1-1 | 4-week paid pilot, one showroom, treatment vs control |
| **E** | 9+ | P1-7, P1-8, P2-1 | Price from pilot evidence; expand in one city |

### Two gates that should be allowed to stop the programme

- **End of phase B — cost per verified model.** If it exceeds **₹2,500**, the unit
  economics in `ar-business-model.md` do not close. Solve content cost (P2-2) or move to
  manufacturers-with-CAD; do not proceed to pilot and do not reprice around it.
- **End of phase C — DT-01.** If the sofa does not measure within ±3% of a tape on the
  mid-range phone, there is no product. Fix it or stop.

---

## One-line summary

**Fix the iOS scale bypass, replace the six wrong models, measure the cost of doing so,
then prove it on three phones.** The engine is finished; everything above is content,
plumbing and evidence.
