# Akruti — Integration & Validation Report

**Date:** 2026-10-28
**Scope:** end-to-end validation of the canonical-asset pipeline and the AR
placement/resize experience, plus resolution of the defects found in review.

> **Akruti is not production-ready.** The pipeline is validated end to end against a
> live database and a live API, and the maths is covered by 204 automated tests. But
> **no AR session has been run on a physical phone at any point in this project.**
> Scale accuracy, grounding, drift and tracking — the things the product is actually
> sold on — remain **unverified**. §6 is the procedure; §7 is the honest scorecard.

---

## 1. What was implemented this phase

### 1.1 Defects fixed

| ID | Severity | Fix |
| -- | -------- | --- |
| **BUG-A** | High | **A resized wall piece sank into its wall and climbed it.** `place()` derived the wall offset from half the piece's depth and height *at placement time*; `applyScale` never recomputed them. New `reseatOnWall()` is called from `applyScale`, reproducing the placement maths at the current size. Measured before the fix: a 30 cm deep unit at 2× sank **15 cm into the wall** and its centre rose **40 cm**. |
| **BUG-B** | High | **The UI stated a size the shop does not sell — on 9 of 9 products.** `originalM` is the size the *model* is drawn at, which equals the catalogue only when the model's shape matches the listing. The Halo lamp read "82 cm" where the shop lists **152 cm**. ResizePanel and ArScene now read `variant.product.dimensionsMm` for any "the shop lists" claim, and keep `originalM` only as the "original size" the reset button returns to. The two are now labelled distinctly. |
| **BUG-C** | Medium | **Blurring an untouched field nudged the piece.** `onBlur` committed the *rounded* displayed value every time, so tabbing through a 212.4 cm sofa made it 212.0. Now only a field the customer actually typed in is committed. |
| **RISK-D** | Medium | A half-typed value could override a slider drag. The draft now clears when `userScale` changes. |
| **RISK-E** | Low | An out-of-range entry clamped silently. The panel now says "This is the smallest/largest size this preview offers." |
| **RISK-F** | Low | `sideRangeMm` was exported and tested but unused — false coverage. ResizePanel now uses it. |
| **RISK-G** | Low | The resize notice now states that the resized view exists only in this AR session and is not what the shop will send. |
| **AR-FALLBACK** | **High** | **A failed WebXR session left no AR path at all** — the longest-surviving defect in this project, present since the first audit. `isSessionSupported` can return true while `requestSession` fails (camera permission, Google Play Services for AR missing or mid-update, another XR session active). New `sessionFailed` state re-enables `<model-viewer>`'s Scene Viewer / Quick Look button and rewrites the error copy. |
| **SEED-1** | Medium | **The whole seeded catalogue reported as "not normalised" to the client.** `seed-store.mjs` normalised the bytes but never wrote the `normalization` column, so the API returned `null`. |
| **SEED-2** | Medium | **Every seeded product had `dimension_source = 'UNKNOWN'`.** Migration 0008's backfill runs before the seed inserts anything, so a fresh `migrate → seed` left it unset. The seed now sets `MANUFACTURER_SPEC` explicitly. |

### 1.2 Tests added

`src/features/experience/placement.test.ts` — **27 tests** at the three.js transform
level, which is the layer that let BUG-A through: it was argued in comments and never
executed. Covers floor and tabletop grounding at 0.5×–2×, position and rotation
invariance, exact round-trip on reset, wall contact and vertical centring (including a
non-axis-aligned wall), and two-instance independence.

**These tests are load-bearing.** Mutating the `reseatOnWall` fix back out makes
**11 of 27 fail**. Tolerances are expressed as `MM = 1e-4` (0.1 mm) with a comment
explaining why: three orders of magnitude above Float32 geometry noise, three orders
below anything a phone can resolve.

---

## 2. Files changed

| File | Change |
| ---- | ------ |
| `src/features/experience/roomEngine.ts` | `reseatOnWall()`; called from `applyScale` |
| `src/features/experience/ResizePanel.tsx` | BUG-B, BUG-C, RISK-D/E/F/G |
| `src/features/experience/ArScene.tsx` | BUG-B in the item card |
| `src/features/experience/ProductArExperience.tsx` | WebXR session-failure fallback |
| `src/features/experience/placement.test.ts` | **new** — 27 transform-level tests |
| `db/scripts/seed-store.mjs` | writes `normalization` and `dimension_source` |
| `vitest.config.ts` | also collect `*.test.tsx` |

Untouched: `room.ts`, `fit.ts`, `units.ts`, `trueScale.ts`, `placement.ts`, `resize.ts`,
`glb.mjs`, `validate.mjs`, `catalog.mjs`, `admin.mjs`, all migrations.

---

## 3. Database and migrations

**No new migration this phase.** `0008_canonical_assets.sql` (from Phase 1) is unchanged
and was verified to apply cleanly on a fresh database.

```
apply  0001_init.sql        apply  0005_product_colours.sql
apply  0002_demo_request.sql   apply  0006_store_pricing.sql
apply  0003_demo_request_verify.sql  apply  0007_store_review.sql
apply  0004_demo_request_phone.sql   apply  0008_canonical_assets.sql
```

Both 0008 columns and both constraints verified present:
`model_asset.normalization`, `product.dimension_source`,
`model_asset_normalization_is_object`, `product_dimension_source_known`.

> **Renamed 2026-10-31:** `0008_canonical_assets.sql` is now `0009_canonical_assets.sql`,
> because `0008_design_request.sql` already used the number 0008. Its row in
> `schema_migrations` was renamed to match, so it is not applied again.

> **Deployment constraint found:** `0001_init.sql` uses `uuidv7()`, which ships in
> **PostgreSQL 18+**. On PostgreSQL 16 the migration fails with
> `function uuidv7() does not exist`. This is not documented in `PROJECT_GUIDE.md`,
> which says only "PostgreSQL running locally". Either state the minimum version or
> add a fallback. *(A shim was used in the test sandbox only; no project file was
> changed.)*

---

## 4. End-to-end validation — executed

Run against **live PostgreSQL 16 + the real Express API**, not mocks.

### 4.1 Retailer → canonical asset → customer

| # | Step | Result |
| - | ---- | ------ |
| 1 | `POST /api/admin/models` with `Chair.glb` | **201.** Raw upload stored. Reported model size **111 013 875 × 137 411 375 × 115 924 109 mm** — the file is authored 111 km wide. |
| 2 | `POST /api/admin/products` **active**, wrong dims (300 × 30 × 40 cm) | **400 — blocked.** `fail:SHAPE_MISMATCH`, *"shape differs from the listed size by up to 789%"* |
| 3 | Same model as **draft** | **201.** Allowed, so the size can be corrected without losing the entry. Check still recorded as `fail`. |
| 4 | `POST` **active** with correct dims (78 × 82 × 94 cm) | **201**, `check: verified` |
| 5 | Blobs after step 4 | **source `9b447ce842…` (59 388 B)** and **serving `c0d8269790…` (59 832 B)** — two distinct blobs |
| 6 | Original upload vs the file on disk | **byte-identical** — the retailer's upload is preserved untouched |
| 7 | Steps 3 and 4 share one source, different listed sizes | **1 source blob → 2 distinct serving blobs.** The shared source is never mutated. |

### 4.2 The bytes a customer actually receives

`GET /api/models/1fac999a…` → **HTTP 200, `model/gltf-binary`, 12 853 308 bytes**

```
measured       : 212.0 x 91.5 x 75.2 cm (W x D x H)
catalogue      : 212.0 x 88.0 x 76.0 cm
base on y = 0  : yes (-0.10 mm)
footprint centre: 0.05 mm from origin
stamp          : v2  verified  factor = 2.1116
runtime factor : 0.99995   <-- IDENTITY: no second scale applied
```

**That last line is the direct proof that normalisation cannot be applied twice.** The
runtime recomputes the factor from the served geometry and gets 1.0, so there is nothing
left to apply.

### 4.3 Catalogue integrity

`dimension_source` now `MANUFACTURER_SPEC` for all 9 seeded products; `normalization`
populated with `pipelineVersion: 2`, status and deviation. After the full upload /
publish / normalise cycle:

```
Halo floor lamp     : 400.0 x 400.0 x 1520.0 mm  [MANUFACTURER_SPEC]
Mahal 3-seater sofa : 2120.0 x 880.0 x  760.0 mm  [MANUFACTURER_SPEC]
```

**Unchanged.** `db:real-size --dry-run` reports **0 models would change** — idempotent.

---

## 5. Platform status

### 5.1 Android WebXR — code paths verified, device behaviour not

Placement, anchoring, tracking states, multi-object, resize and fit are implemented and
covered by tests at the pure-maths and transform levels. **None has been observed on a
phone.**

Session-failure fallback is now implemented and typechecks; the *recovery* path itself is
device-only to confirm.

### 5.2 iOS — USDZ pre-generation attempted, NOT shipped

The brief asks for pre-generated USDZ served from real URLs. I attempted it with
three.js's `USDZExporter` in Node:

| Model | Result |
| ----- | ------ |
| `Chair.glb` (no textures) | **165 100 bytes of valid USDZ**, scene measures **78.0 × 81.5 × 96.5 cm** — exactly the canonical asset |
| `Sofa.glb` (2 × 2048 px textures) | **FAILED — `self is not defined`** |
| `Stool.glb` (1 texture) | **FAILED — `self is not defined`** |

GLTFLoader's texture path needs browser globals (`ImageBitmap`/`createImageBitmap`).
Untextured models work and are dimensionally correct; **textured models — including the
flagship sofa — do not.**

**I did not ship a half-working pipeline.** iOS still uses `<model-viewer>`'s
auto-generated USDZ from a Blob URL, which means `allowsContentScaling=0` remains
dependent on a Safari Blob-URL fragment bug (WebKit 236069). Options, in order of
effort: polyfill `createImageBitmap` in Node; use Apple's `usdzconvert` /
`usd_from_gltf` as an external binary; or keep auto-generation and accept that scale
lock on iOS is best-effort.

**The product page does not over-promise.** On non-WebXR devices it states: *"On this
device AR shows one piece at a time, at its listed size. To place several pieces, resize
them or check the fit in your room, open this page in Chrome on an ARCore-supported
Android phone."*

---

## 6. Physical-device testing — PROCEDURE ONLY, NOT RUN

**No physical device was available. No measurement in this document is a device
measurement. Nothing below has been executed.**

### Setup

1. `npm run dev:tunnel` — prints an HTTPS URL and QR code (WebXR requires HTTPS).
2. Scan with an ARCore-supported Android phone in Chrome.
3. The button must read **"View in your room"**. If it reads "View in AR" you are on
   plain HTTP and in Scene Viewer, which has none of these features.
4. Append `?debug` to the URL for the diagnostics overlay.

### Reference object

Use the **Mahal 3-seater sofa**, catalogue **212 × 88 × 76 cm**, `status: verified`
(worst-axis deviation 3.8%). Independently verify the real piece with a tape before
using it as the reference.

### Record per device — a row without numbers is a failed test, not a blank

```
Device ______________  Android ____  Chrome ____  Play Services for AR ____
Room ____________  Light: bright/normal/dim   Floor: plain/rug/gloss/tile
Network ______ Mbps    Tape measure: yes/no    Commit ____________
```

| ID | Test | Pass criterion |
| -- | ---- | -------------- |
| **D1** | Tape 2.00 m on the floor. Place the sofa with one end on the mark, width along the tape. Measure. | **±3% or ±2 cm, whichever is greater** → 206–218 cm |
| D2 | Repeat D1 standing 1 m, 2 m, 3 m away | all within D1 tolerance, and within 2% of each other |
| D3 | **Ruler cross-check**: measure the same 2.00 m tape with the in-app ruler | Record the error. *If the sofa and the ruler are off by the same amount, the fault is the phone's tracking, not the pipeline.* |
| D4 | Look along the floor at the placed sofa | no gap under the legs, not sunk in |
| D5 | Tape the footprint corners. Walk a 15 m loop out of the room and back | **< 5 cm** displacement. Record cm. |
| D6 | Hold still 60 s | < 1 cm creep |
| D7 | Orientation: does the sofa face the camera on placement? | front toward viewer; record any 180° error |
| **D8** | **Resize to 180 cm via the width field, measure** | within tolerance of 180 cm |
| D9 | Resize to 0.5× and 2×, look along the floor | still grounded, no sink or float |
| **D10** | **Place a mirror on a wall, resize to 2×** | **stays flush with the wall, stays centred on the spot it was hung** (BUG-A regression) |
| D11 | Reset to original size, measure | back to 212 cm |
| D12 | Resize one of two identical sofas | the other does not change |
| D13 | Drag two chairs together | red outline, "may overlap" |
| D14 | Leave ~40 cm between two chairs | amber, "too narrow to walk through" |
| D15 | ~40 cm between sofa and coffee table | no warning (companion rule) |
| D16 | Repeat D1 on plain floor, patterned rug, glossy tile, low light | record time-to-floor-lock and any failure |
| D17 | Cover the camera 5 s; whip-pan | "tracking lost"; dragging stops; pieces return |
| **D18** | **Revoke camera permission, tap AR** | **a working Scene Viewer path is offered** (AR-FALLBACK regression) |
| D19 | Throttle to 3G, open the sofa, enter AR | record seconds to first paint |
| D20 | Place 8–10 pieces, use 10 minutes | record FPS, heat, any reload |
| **D21** | **iPhone: open each of the 9 products, tap AR** | record the size shown and whether pinch is locked |
| D22 | iPhone: compare the sofa's size against Android | within 3% |

**Minimum fleet: three Android phones** (one recent flagship, one **mid-range 2–3 years
old — the actual target market**, one without Depth API) **plus one iPhone**.

---

## 7. Acceptance criteria

| # | Criterion | Status | Evidence |
| - | --------- | ------ | -------- |
| A1 | Shape agreement gated at ingest (>5% blocked) | **PASS** | §4.1 step 2 — 400, `SHAPE_MISMATCH` |
| A2 | Canonical asset is identity-scaled | **PASS** | §4.2 — runtime factor 0.99995 |
| A3 | Rendered width within ±3%/±2 cm of a tape | **NOT RUN** | D1 |
| A4 | Scale consistent across viewing distance | **NOT RUN** | D2 |
| A5 | Floor placement, no gap or sink | **PASS (maths)** / **NOT RUN (device)** | 27 transform tests; D4 |
| A6 | Orientation within ±5° | **NOT RUN** | D7 |
| A7 | Static drift < 1 cm / 60 s | **NOT RUN** | D6 |
| A8 | Loop drift < 5 cm after 15 m | **NOT RUN** | D5 |
| A9 | Room measurement ±3%/±5 cm | **NOT RUN** | — |
| A10 | Clearance reported with tolerance | **FAIL** | still printed as an exact cm figure |
| A11 | Model < 5 MB, first paint < 3 s @ 8 Mbps | **FAIL** | sofa is **12.26 MB** stored / 12.85 MB served |
| A12 | Cross-device consistency within 2% | **NOT RUN** | D22 |
| A13 | iOS size parity within 3% | **NOT RUN** | D21 |
| C1 | `dimension_source` is MEASURED or MANUFACTURER | **PASS** | §4.3 — all 9 `MANUFACTURER_SPEC` |
| C2 | Only `verified` models publishable | **PASS** | §4.1 steps 2–4 |
| C3 | Served asset measures the declared size | **PASS** | §4.2 — 212.0 cm vs 212.0 cm |
| C4 | Every delivery path consumes the canonical asset | **PARTIAL** | WebXR + Scene Viewer yes; **iOS USDZ auto-generated, §5.2** |
| C5 | User resizing locked, or qualified per path | **PARTIAL** | WebXR yes; iOS best-effort |
| C6 | Normalisation cannot be applied twice | **PASS** | §4.2 + 99 idempotence tests |
| C7 | Resizing never modifies catalogue data | **PASS** | §4.3 + `baseSize` tests |
| C8 | Original upload preserved | **PASS** | §4.1 step 6 — byte-identical |
| C9 | Diagnostic overlay disabled in production | **PASS** | §8 |
| C10 | Measured numbers recorded, not asserted | **PASS for software** / **NOT RUN for device** | — |

**13 PASS · 2 PARTIAL · 2 FAIL · 9 NOT RUN.**

---

## 8. Final quality checks

| Check | Result |
| ----- | ------ |
| `npx vitest run` | **204 passed, 0 failed**, 5 files, 1.78 s |
| `npx tsc --noEmit` | **0 errors** |
| `npx vite build` | **PASS**, 7.05 s |
| All `.mjs` parse | **PASS** |
| Migrations on a fresh DB | **PASS** (8 applied) |
| Asset-serving path | **PASS** — correct bytes, type and length |
| Normalisation idempotent | **PASS** — `real-size --dry-run`: 0 changes |
| **Diagnostic overlay in production** | **PASS — fully tree-shaken.** `import.meta.env.DEV` → 0 chunks; the `?debug` check → 0 chunks; every string unique to `ArDebugPanel` ("dim source", "runtime ×", "target y", "RAW (not normalised)") → **0 chunks**. *This corrects my Phase-2 statement that ~0.66 kB remained.* |

Test breakdown: `glb.test.mjs` 99 · `resize.test.ts` 31 · `placement.test.ts` 27 ·
`geometry.test.ts` 25 · `validate.test.mjs` 22.

Bundle: `index` 450.89 kB (130.08 kB gz) · `model-viewer` 437.67 kB (136.18 kB gz) ·
`GLTFLoader` 643.88 kB (165.85 kB gz, lazy) · `ArScene` lazy.

---

## 9. Remaining bugs and limitations

| # | Issue | Severity |
| - | ----- | -------- |
| 1 | **`Sofa.glb` is 12.26 MB / 282 k triangles.** ~13 s on 8 Mbps, ~68 s on 3G, downloaded *inside* a live AR session. Three colourways share it, so three sofas ≈ 846 k triangles. | **High** |
| 2 | **6 of 9 catalogue models are `approximate`** (14–85% off). They publish because they predate the gate; a new upload with those dimensions would be blocked. The Halo lamp draws at **82 cm** where the shop lists **152 cm**. | **High** |
| 3 | **iOS USDZ is still auto-generated from a Blob URL**, so scale lock depends on a Safari bug. §5.2. | **High** |
| 4 | **No device measurements exist.** A3–A9, A12, A13 unverified. | **Critical to the claim** |
| 5 | Clearance printed as an exact cm figure although it inherits room-measurement error (A10). | Medium |
| 6 | `PostgreSQL 18+` required (`uuidv7()`), undocumented. | Medium |
| 7 | `model-viewer` (136 kB gz) loads on every product page even where WebXR is the path. | Low |
| 8 | Resizing is WebXR-only; a resize does not carry into Quick Look. Disclosed in the UI. | By design |
| 9 | `ADMIN_TOKEN` is `12345` in `PROJECT_GUIDE.md`. | Medium before any public deploy |

---

## 10. How to run and test

```sh
npm install
npm run db:setup           # create + migrate + seed   (PostgreSQL 18+)
npm run db:seed:store      # the 9 store products, normalised at seed
npm run dev:all            # API :3001 + site :5173
```

Open **http://localhost:5173** — storefronts at `/store/nivaas`, `/store/saaj`,
`/store/kadam`.

```sh
npm test                   # 204 tests
npm run typecheck          # tsc --noEmit
npm run build              # typecheck + tests + vite build
npm run db:real-size -- --dry-run   # report; never writes
npm run dev:tunnel         # HTTPS + QR for phone AR
```

**Phone AR:** `npm run dev:tunnel`, scan the QR, open a product, tap **"View in your
room"**. Add `?debug` for the overlay. Then work through §6 and **write the numbers
down**.

**Verify the pipeline yourself:**

```sh
# the served asset must measure the catalogue size
curl -s localhost:3001/api/variants | head -c 400
# blocked publish (wrong proportions) -> 400 SHAPE_MISMATCH
# correct dimensions -> 201 verified
```

---

## 11. Conclusion

The canonical-asset pipeline is **validated end to end against a live database and API**:
a retailer's upload is gated, normalised once, stored as a separate content-addressed
blob with the original preserved byte-identical, and served so that the runtime applies
an identity factor. Resizing is per-instance, proportional, reversible, and never
touches catalogue data. 204 automated tests pass, and the two that mattered most were
written *because* review found bugs the previous suite had missed.

**What is still missing is the only thing a retailer actually buys: evidence that a sofa
measures 212 cm on a real floor.** Until §6 has been executed and the numbers recorded,
Akruti should not claim real-world dimensional accuracy, and should not be called
production-ready.
