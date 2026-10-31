# Akruti — AR Architecture Audit (AR_UI_02)

**Audit date:** 2026-10-27
**Repository:** `C:\SohamAdchule\AR_UI_02`
**Method:** static inspection of the full `src/` tree (≈110 files), `server/`, `db/`;
direct binary measurement of all 10 catalogue GLBs; 21 unit tests executed against the
real modules; `tsc --noEmit` and `vite build` run to completion.
**Not done:** no AR session on a physical device.

> **Correction notice.** An earlier audit in this engagement was run against
> `C:\SohamAdchule\AR` by mistake. That repository is a different, much earlier
> Next.js prototype. **Every technical finding from that audit is void for this
> project** — in particular the claim that room/fit/dimension logic "does not exist."
> It exists here, it is well built, and it works. The market, competitor and business
> research is unaffected and still applies.

---

## 1. What this system is

A **Vite + React 18 marketing site, multi-brand storefront, admin CMS and a full
in-page WebXR room-furnishing engine**, backed by an Express API and PostgreSQL.

```
Express API (:3001) ──► PostgreSQL (product / variant / model_asset / model_blob)
      │                        │
      │                        └── GLB bytes stored in-DB, deduplicated by SHA-256,
      │                            versioned per variant (is_current)
      │
Vite SPA (:5173)
      ├── marketing site + 3 demo brand storefronts (/store/nivaas | saaj | kadam)
      ├── admin (demo requests, models, upload, reviews)
      └── product page ──► ProductArExperience
                              ├── WebXR supported ──► ArScene + roomEngine  (the real product)
                              └── otherwise        ──► <model-viewer> → Quick Look / Scene Viewer
```

### Stack

| Concern | Choice |
| ------- | ------ |
| Build / app | Vite 5, React 18.3, React Router 6.30, TypeScript 5.6 (`strict`, `noUnusedLocals`) |
| 3D / AR engine | three.js 0.183 + WebXR, hand-written (`roomEngine.ts`, 43 KB) |
| 3D viewer / iOS AR | `@google/model-viewer` 4.3 |
| API | Express 4.22, ES modules |
| DB | PostgreSQL via `pg` 8.23, hand-rolled SQL migrations (7) |
| Styling | Tailwind 3.4 |
| Email | nodemailer |

**No test framework is installed.** There is no vitest/jest/playwright. (The 21 tests in
§5 were written and run by this audit using the project's own esbuild.)

---

## 2. The dimensional data path — the thing that matters

This is where the previous prototype had nothing. Here it is a designed, working system.

```
Admin enters real size (mm, with cm/in/mm display)
            │
            ▼
  product.width_mm / depth_mm / height_mm   ◄── SOURCE OF TRUTH
            │
            ▼
   Variant.product.dimensionsMm ──┐
                                  ├──► resolveTrueScale(modelBBox, dimensionsMm)
   GLB loaded, measured           │         │
   vertex-accurate Box3 ──────────┘         ├─ median of per-axis ratios → single factor
                                            ├─ retry with width/depth swapped → side-on fix
                                            ├─ deviation ≤5%  → "verified"
                                            ├─ deviation >5%  → "approximate" + notice
                                            └─ no dims        → power-of-ten unit rescue
            │
            ▼
   isPlaceable()  — refuse anything >6 m or <5 cm
            │
            ▼
   model.rotation.y = swap ? π/2 : 0
   model.scale.setScalar(factor)
   model.position.set(-centre.x, -fitted.min.y, -centre.z)   ← footprint centred, base on y=0
```

**This is the correct architecture.** The catalogue is authoritative, the file is
evidence, and the reconciliation is explicit, bounded and reported to the user. It is
materially better than treating the GLB as truth.

Verified by execution (§5): the algorithm rescues a chair authored **111 km** wide to a
correct 78 cm, and correctly detects the bookshelf as authored side-on.

### 2.1 Where it still breaks — the iOS path

`ProductArExperience` chooses:

- **WebXR available** → `ArScene` + `roomEngine`. Scale correction applied. Correct.
- **otherwise** (every iPhone — Safari ships no WebXR) → `<model-viewer>` with
  `ar-modes="webxr scene-viewer quick-look"` and `ar-scale="fixed"`.

`ar-scale="fixed"` means *"100% of the GLB's authored scale."* **It does not know about
`product.dimensionsMm`.** The entire `trueScale` correction is bypassed.

Measured consequence across the live 9-product catalogue:

| Product | Correction factor the WebXR path applies | What iOS/Quick Look shows instead |
| ------- | ---------------------------------------- | --------------------------------- |
| Mahal sofa | ×2.11 | 100 cm wide instead of 212 cm |
| Ira lounge chair | ×0.0000070 | **111 km wide** |
| Sabha dining table | ×0.0000256 | **47.7 km wide** |
| Nook side table | ×0.0000010 | **530 km wide** |
| Kaam writing desk | ×0.0000020 | **687 km wide** |
| Grid bookshelf | ×0.0180 (+90° turn) | 18 m wide, un-turned |
| Alcove wardrobe | ×0.554 | 364 cm instead of 202 cm |
| Perch bar stool | ×1.033 | ~35 cm (close) |
| Halo floor lamp | ×0.0000091 | **44 km wide** |

**Only 1 of 9 products (the stool) is approximately right on iOS.** This is the single
most serious defect in the system and it is not listed in `docs/ar-changes.txt`, which
describes the iOS path only as *"the old single-product viewer, at the file's own
scale"* — technically accurate, but it understates the outcome: on an iPhone, two-thirds
of the catalogue is kilometres wide and simply will not render as furniture.

**The fix is cheap and fixes Scene Viewer too:** apply the `trueScale` factor
server-side when streaming the GLB (rewrite the root node's scale/rotation in the glTF
JSON — no re-meshing needed), so *every* consumer of `/api/variants/<id>/model` gets a
correctly-sized file. That also removes the correction from the hot path on Android.

---

## 3. The AR engine — component review

### 3.1 `src/lib/` — pure logic (excellent)

| File | Size | Assessment |
| ---- | ---- | ---------- |
| `trueScale.ts` | 4.0 KB | **Keep as-is.** Median-ratio reconciliation, side-on detection, unit rescue, placeability bounds. Tested, correct. |
| `room.ts` | 8.8 KB | **Keep.** Clean SAT penetration, nearest-point polygon distance, even-odd containment, walkway/companion thresholds. Tested, correct. |
| `fit.ts` | 3.1 KB | **Keep.** Never resizes the product; reports "12 cm too wide"; offers turned orientation; localStorage-backed with try/catch. Tested, correct. |
| `placement.ts` | 1.3 KB | Works, but **regex over the product name** decides floor/wall/tabletop. Fragile — a DB column is the right answer (their own docs agree). |
| `units.ts` | 1.3 KB | mm storage, cm/in/mm display. Fine. |
| `webxr.ts` | 1.4 KB | `hit-test` required; `dom-overlay`, `light-estimation`, `anchors` optional. |

All six are browser-free and three.js-free, so they unit-test in Node — which is exactly
why §5's tests were possible in minutes. **This separation is the codebase's best
structural decision.**

### 3.2 `roomEngine.ts` (43 KB) — the AR engine

Verified present and correct by inspection:

| Capability | Implementation | Verdict |
| ---------- | -------------- | ------- |
| **Anchoring** | `t.hit?.createAnchor?.()`, then every frame `frame.trackedAnchors.has(anchor)` → `frame.getPose(anchor.anchorSpace, space)` → rewrite `room.matrix` | **Correct — this is exactly the spec-recommended pattern.** Degrades gracefully when anchors are unsupported. |
| **Surface classification** | Hit pose column 1 = surface normal; `n.y > 0.94` → horizontal; `\|n.y\| < 0.3` → wall; floor vs raised by height in room frame (±15 cm) | **Correct.** The WebXR Hit Test spec provides no orientation filter, so reading the normal yourself is the documented approach. |
| **Floor lock** | Before lock, floor = lowest level surface ≥60 cm below the phone; first tap fixes the room frame; `lowestHorizontal` reset in `resetAll()` | Correct |
| **Tracking state** | `frame.getViewerPose()`; `pose.emulatedPosition` → `limited`; null → `lost`; drag dropped on loss | **Correct, and subtle** — `emulatedPosition` is the right signal and is often missed |
| **Grounding** | `model.position.set(-centre.x, -fitted.min.y, -centre.z)` after scale+rotation | Correct — footprint centred, base exactly on y=0 |
| **Double-tap fix** | `beforexrselect` cancelled on the overlay root | Correct — this is the documented fix for dom-overlay taps also firing XR `select` |
| **Frame-loop resilience** | `try { update() } catch { console.error }` then always render | Correct — a bad frame cannot freeze the camera |
| **Asset reuse** | Models cached by URL; copies `clone(true)`; per-colour material clones tracked in `owned[]` and disposed | Correct |
| **Unplaceable guard** | `isPlaceable()` refuses >6 m / <5 cm with a message naming the shop | Correct |

Not implemented (all acknowledged in the project's own `ar-market-comparison.txt` §7):
`light-estimation` is requested but never consumed; no depth sensing / occlusion; no
plane detection (correctly — it is still Developer Trial in Chrome).

### 3.3 Server and data layer

- **Auth is real**: `Authorization: Bearer <ADMIN_TOKEN>` compared with
  `crypto.timingSafeEqual`, length-checked first. `requireAdmin` middleware. Correct.
- **Model storage**: bytes in `model_blob` keyed by SHA-256 (deduplicated), referenced by
  `model_asset` with `version` + `is_current` per variant. Replacing a model adds a
  version rather than overwriting. Good design, same spirit as the earlier prototype's
  opaque-key scheme.
- **Upload**: 50 MB cap; `glbMeta(bytes)` validates the container *before* anything is
  stored; the response reports detected materials and the model's own dimensions so the
  uploader can reconcile them.

**Gap:** there is no *quality* gate at upload — no triangle budget, no texture budget, no
size budget, no rejection when the model's shape contradicts the entered dimensions. The
project's own market doc recommends exactly this (§5 item 2) and it is not built. 50 MB
is 10× the ~5 MB budget the same doc cites from Shopify.

---

## 4. Build and type status (executed)

| Check | Result |
| ----- | ------ |
| `npx tsc --noEmit` (strict, `noUnusedLocals`, `noUnusedParameters`) | **PASS — 0 errors** |
| `npx vite build` | **PASS — 1,771 modules, built in 6.99 s** |

Bundle output:

| Chunk | Raw | gzip |
| ----- | --- | ---- |
| `index.js` | 415.9 KB | 120.8 KB |
| `model-viewer.js` | 437.7 KB | 136.2 KB |
| `GLTFLoader.js` (three.js, lazy) | 643.9 KB | 165.9 KB |
| `ArScene.js` (lazy) | 44.2 KB | 14.5 KB |
| `index.css` | 74.0 KB | 14.1 KB |

`ArScene` and `GLTFLoader` are correctly code-split behind the AR entry point. But
**`model-viewer` (136 KB gzipped) loads on every product page**, and the initial JS is
~257 KB gzipped before any model downloads. On a mid-range Indian Android over 4G that is
a real cost on a page whose job is to show one sofa.

> As with any codebase: a clean typecheck and a clean build say nothing about whether a
> sofa appears at 212 cm on a real floor. Both passed here; §6 lists what remains unknown.

---

## 5. Logic verified by execution

21 unit tests written against the project's real modules (bundled with the project's own
esbuild, `@` alias intact) and run in Node. **21 passed, 0 failed.** Full output in
`ar-validation-results.md`.

Coverage: SAT penetration (including the 45°-rotation case where a naive AABB would be
wrong), nearest-point gaps against the 0.6 m walkway and 0.35 m companion thresholds, all
four `checkFit` branches including `fits-turned`, and five `resolveTrueScale` cases
including the 111 km rescue and the side-on bookshelf.

**This took under an hour and found no defects in that logic.** It is strong evidence the
pure layer is sound — and strong evidence that the project should simply keep these tests.

---

## 6. Keep / fix / postpone

| Verdict | Items |
| ------- | ----- |
| **Keep unchanged** | `trueScale.ts`, `room.ts`, `fit.ts`, `units.ts`; the anchor implementation; surface classification; tracking states; `beforexrselect` fix; grounding maths; model caching + material disposal; SHA-256 blob store with versioned `model_asset`; timing-safe admin auth; `ar-scale="fixed"` on the fallback path |
| **Fix (P0)** | **iOS/Scene Viewer size (§2.1) — bake the scale server-side**; WebXR-session-failure fallback to Scene Viewer; upload quality gate (shape/size/triangles/textures); replace or re-model the 6 "approximate" products; compress `Sofa.glb` |
| **Add (P0)** | A test runner, keeping the 21 tests in §5; an on-device debug overlay |
| **Fix (P1)** | `placementSurface` as a DB column instead of a name regex; `visibilitychange` handling; `model-viewer` off the critical path for WebXR devices |
| **Postpone (P2)** | Light estimation (requested but unused), depth occlusion, saved/shared layouts, add-to-cart in AR |
| **Do not build** | Automatic wall detection or room mesh — plane detection is still Developer Trial in Chrome and most Android phones have no LiDAR. The project already reached this conclusion independently and it is correct. |

---

## 7. Verdict

**The architecture is sound and should not be rewritten.** The separation of pure
geometry from the engine, the decision to make the catalogue authoritative over the file,
and the anchor/surface/tracking implementations are all done properly — better than the
project's own documentation gives it credit for.

Two things stand between this and a demonstrable product, and neither is architectural:

1. **The iOS path silently bypasses the entire scale system** (§2.1). One server-side
   transform fixes it for iOS *and* Scene Viewer *and* simplifies the Android path.
2. **Six of nine models do not match their listed dimensions** — rendered 35–68% wrong
   and labelled "approximate". The engine is now honest about this, which is right, but
   honesty is not the same as a product. See `ar-product-model-audit.md`.

Both are content-and-plumbing problems, not engine problems. The engine is the part that
is finished.
