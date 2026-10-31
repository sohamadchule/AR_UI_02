# Akruti — Bug Report (AR_UI_02)

**Date:** 2026-10-27
**Scope:** defects found by static inspection, binary model measurement, 21 executed unit
tests, and a full typecheck + production build. **No fixes applied** — audit only.

### Evidence vocabulary

| Tag | Meaning |
| --- | ------- |
| **CONFIRMED (executed)** | Reproduced by running code in this session. |
| **CONFIRMED (measured)** | Derived from direct binary measurement of the real assets. |
| **CONFIRMED (static)** | Deterministic from the source; the control flow admits no other outcome. |
| **PLAUSIBLE (device)** | Expected, but needs a physical Android phone to prove. |
| **NOT A BUG** | Hypothesis tested and refuted; recorded so it is not re-raised. |

---

## Summary

| ID | Severity | Status | Title |
| -- | -------- | ------ | ----- |
| **BUG-01** | **Critical** | CONFIRMED (measured) | iOS / Scene Viewer bypasses the entire scale system |
| **BUG-02** | **High** | CONFIRMED (measured) | 6 of 9 catalogue models render 14–85% wrong |
| **BUG-03** | **High** | CONFIRMED (static) | WebXR session failure leaves no AR path at all |
| **BUG-04** | **High** | CONFIRMED (measured) | `Sofa.glb` is 12.85 MB / 282k triangles inside a live AR session |
| **BUG-05** | Medium | CONFIRMED (static) | No quality gate at upload; `MAX_GLB_MB` is 50 |
| **BUG-06** | Medium | CONFIRMED (static) | Placement surface decided by regex on the product name |
| **BUG-07** | Medium | CONFIRMED (static) | No `visibilitychange` handling |
| **BUG-08** | Medium | CONFIRMED (measured) | CC-BY 3.0 attribution not displayed |
| **BUG-09** | Medium | CONFIRMED (static) | `light-estimation` requested every session, never consumed |
| **BUG-10** | Low | CONFIRMED (executed) | `model-viewer` (136 KB gz) loads on every product page |
| **BUG-11** | Low | CONFIRMED (static) | AR failure message asserts one cause among several |
| **BUG-12** | Low | CONFIRMED (static) | No test runner installed |
| NAB-01 | — | NOT A BUG | `lowestHorizontal` is not stale across "Start over" |
| NAB-02 | — | NOT A BUG | Non-zero model `min.y` does not cause floating/sinking |
| NAB-03 | — | NOT A BUG | `+Z`-toward-camera facing is spec-correct |
| NAB-04 | — | NOT A BUG | Anchors, surface filtering and tracking states are all properly implemented |

---

## BUG-01 — iOS / Scene Viewer bypasses the entire scale system

**Severity:** Critical · **Status:** CONFIRMED (measured)
**Files:** `src/features/experience/ProductArExperience.tsx:70–76`, `ModelViewer.tsx:299–301`

**Expected:** a product appears at its catalogue size in AR, on any device.

**Actual:** when `isImmersiveArSupported()` is false — **every iPhone**, because Safari
ships no WebXR — the component falls back to `<model-viewer>` with:

```tsx
"ar-modes": "webxr scene-viewer quick-look",
"ar-scale": "fixed" as const,
```

Per model-viewer's documentation, `ar-scale="fixed"` means *"keeps the model at 100%
scale."* **100% of the GLB's authored scale** — it has no knowledge of
`product.dimensionsMm`. The whole `resolveTrueScale` pipeline is on the WebXR path only.

**Measured consequence** across the live catalogue (factors from running the project's own
algorithm):

| Product | WebXR draws | iOS / Quick Look draws |
| ------- | ----------- | ---------------------- |
| Mahal sofa | 212 cm | 100 cm |
| Ira lounge chair | 78 cm | **111 km** |
| Sabha dining table | 122 cm | **47.7 km** |
| Nook side table | 67 cm | **530 km** |
| Kaam writing desk | 140 cm | **687 km** |
| Grid bookshelf | 180 cm, turned | 18 m, un-turned |
| Alcove wardrobe | 202 cm | 364 cm |
| Perch bar stool | 36 cm | ~35 cm ✓ |
| Halo floor lamp | 41 cm | **44 km** |

**1 of 9 products is approximately correct on iOS.**

**Root cause:** the scale correction lives in the renderer rather than in the asset. Any
consumer that is not `roomEngine` gets raw, unscaled geometry.

**Why this is worse than the project's docs suggest.** `docs/ar-changes.txt` describes the
iOS path as *"the old single-product viewer, at the file's own scale"*, which reads like a
fidelity trade-off. It is not — for two-thirds of the catalogue it is a total failure,
and it fails silently.

**Smallest fix — and it fixes three things at once:** apply the scale server-side when
streaming `/api/variants/<id>/model`. Rewriting the root node's `scale` (and `rotation`
for `swapWidthDepth`) in the glTF JSON chunk is a small transform — no re-meshing, no
re-encoding of buffers. Then:
- iOS Quick Look is correct,
- Android Scene Viewer (the non-WebXR Chromium fallback) is correct,
- `roomEngine` can stop correcting at runtime, and `trueScale` becomes an
  upload-time/admin concern rather than a hot-path one.

**Regression test:** assert the streamed GLB's root-node scale equals the expected factor
for each seeded product. Pure Node, no device.

---

## BUG-02 — 6 of 9 catalogue models render 14–85% wrong

**Severity:** High · **Status:** CONFIRMED (measured)

Full table in `ar-product-model-audit.md` §1. The worst cases:

| Product | Declared | Rendered | Error |
| ------- | -------- | -------- | ----- |
| Halo floor lamp | 152 cm tall | **82 cm** | **85.4%** |
| Sabha dining table | 75 cm high | **49 cm** | 53.0% |
| Alcove wardrobe | 120 cm wide | **202 cm** | 40.6% |
| Nook side table | 55 cm wide | 67 cm | 38.8% |
| Kaam writing desk | 65 cm deep | 81.5 cm | 20.3% |
| Perch bar stool | 74 cm tall | 86 cm | 14.1% |

**This is not an engine defect.** `resolveTrueScale` correctly reports these as
`approximate` and the UI shows a notice. The models are not the products.

**Why it still belongs in a bug report:** a dining table at coffee-table height produces
*wrong answers* from the features built on top of it — the overlap checks, the wall
clearance, the walkway warnings and the "will it fit?" result are all computed from the
rendered footprint. Honest labelling does not make the downstream output correct.

**Fix:** replace the six models (see `ar-product-model-audit.md` §5.2). No code change.

---

## BUG-03 — WebXR session failure leaves no AR path at all

**Severity:** High · **Status:** CONFIRMED (static) · **File:** `ProductArExperience.tsx:52–61, 70–76`

`showArButton={webXrSupported === false}` hides `<model-viewer>`'s AR button whenever
`isSessionSupported("immersive-ar")` returned **true**. If `requestSession` then
**rejects**, the catch only sets a string:

```ts
.catch(() => setError("Couldn't start AR. Camera permission may be blocked."));
```

The user is left with a 3D viewer and no AR route — on a device that would very likely
have run Scene Viewer fine.

**Why this is not an edge case:** `isSessionSupported` can return true while
`requestSession` fails — camera permission denied, **Google Play Services for AR missing
or mid-update** (a separately installed, separately updated component per Google's ARCore
documentation), another XR session active, or lost user activation. On the mixed
mid-range Android fleet that is Akruti's actual target market, this is routine.

**Smallest fix:** on rejection, set state that re-enables `showArButton` so the Scene
Viewer path becomes available, and reword the message (see BUG-11).

---

## BUG-04 — `Sofa.glb` is 12.85 MB / 282k triangles, downloaded inside a live AR session

**Severity:** High · **Status:** CONFIRMED (measured)

282,111 triangles and 3.91 MB of 2048² JPEG, versus a median of ~800 triangles and 0.03 MB
across the rest of the catalogue. ~12.9 s on 8 Mbps 4G, ~68 s on 3G — while the customer
holds the phone at an empty camera feed. Three colourways share the one GLB, so three
placed sofas is ~846k triangles.

Already known to the project (`PROJECT_GUIDE.md` §5, `ar-changes.txt` "Still heavy").
Recorded here because it is a release blocker, not a nice-to-have.

**Fix:** KTX2/BasisU the textures (biggest win), Draco/meshopt the geometry, decimate
toward 20–40k triangles. Target <5 MB. Add a load timeout and a "continue in 3D" escape.

---

## BUG-05 — No quality gate at upload

**Severity:** Medium · **Status:** CONFIRMED (static) · **File:** `server/admin.mjs:15, 55–69`

`glbMeta(bytes)` validates the *container* before storing, and the response reports
detected materials and the model's own dimensions. But nothing refuses or warns on:

- shape deviation from the entered dimensions (the `trueScale` check exists — it just is
  not applied at upload),
- `MAX_GLB_MB = 50` — **10× the ~5 MB budget** the project's own market doc cites from
  Shopify,
- triangle count,
- texture resolution or bytes,
- implausible dimensions.

Every defect in `ar-product-model-audit.md` would have been caught here. The project's own
`ar-market-comparison.txt` §5 item 2 recommends exactly this gate.

**Fix:** run `resolveTrueScale` at upload; block `FAIL`, warn on `WARN`, and show the
admin the AR-size preview before publish.

---

## BUG-06 — Placement surface decided by regex on the product name

**Severity:** Medium · **Status:** CONFIRMED (static) · **File:** `src/lib/placement.ts`

```ts
const RULES: [RegExp, Placement][] = [
  [/\b(wall (shel(f|ves)|lamps?|...)|mirrors?|paintings?|...)\b/, 'wall'],
  [/\b(table lamps?|desk lamps?|vases?|planters?|...)\b/, 'tabletop'],
];
```

Matched against `` `${v.product.name} ${v.category.name}` ``. Works for the current nine,
but a retailer naming a product "Halo table lamp" (floor-standing) or "Mirror finish
console" gets the wrong placement mode, and the error is invisible until someone tries to
place it. Acknowledged in the project's own known-limits list.

**Fix:** a `placement_surface` column (`floor | wall | tabletop | ceiling`), defaulted
from the regex at seed/upload and editable in admin.

---

## BUG-07 — No `visibilitychange` handling

**Severity:** Medium · **Status:** CONFIRMED (static) · **File:** `roomEngine.ts`

`session.visibilityState` is never consulted and no `visibilitychange` listener is
registered (verified: zero occurrences). When the user switches apps or takes a call, the
render loop keeps running against a session that may be `hidden` or
`visible-blurred` — wasted battery, and no defined behaviour on return.

`getViewerPose` null-handling covers tracking loss well, so this is the smaller remaining
gap in the session lifecycle.

---

## BUG-08 — CC-BY 3.0 attribution not displayed

**Severity:** Medium · **Status:** CONFIRMED (measured) · **File:** `db/seed/furniture/SOURCE.txt`

Eight of nine catalogue models are Google Poly archive assets under **CC-BY 3.0**. The
project's own `SOURCE.txt` states: *"attribution required if these ship publicly."* No
attribution appears in the UI, and the models are served to any visitor via
`/api/variants/<id>/model`.

Also: `db/seed/models/chair-damask.glb` carries the embedded string
`(c) 2021 Wayfair, CC BY 4.0 International` — a **competitor's asset**. Unused by the
store catalogue but still seeded by the older path.

**Fix:** display attribution, or replace the assets (preferred — it also fixes BUG-02).

---

## BUG-09 — `light-estimation` requested every session, never consumed

**Severity:** Medium · **Status:** CONFIRMED (static) · **Files:** `src/lib/webxr.ts:25`, `roomEngine.ts`

`light-estimation` is in `optionalFeatures`, but `getLightEstimate` / `XRLightProbe`
appear **zero times**. Products are lit identically in a sunlit showroom and a dim
bedroom — the main reason AR furniture reads as "pasted on". Acknowledged in the
project's own market doc §7 as available-but-unused.

Worth measuring before shipping: Google documents known issues with model-viewer's
equivalent (`xr-environment`) — scenes too dark, abrupt updates, metals going matte.

---

## BUG-10 — `model-viewer` loads on every product page

**Severity:** Low · **Status:** CONFIRMED (executed)

From the production build: `model-viewer-DTEXg1ZK.js` is **437.7 KB raw / 136.2 KB
gzipped**, and it is imported by `ModelViewer`, which `ProductArExperience` renders
unconditionally. `ArScene` and `GLTFLoader` are correctly lazy; `model-viewer` is not.

On a WebXR-capable Android — the primary target — model-viewer is only the *fallback*,
yet it is paid for on first load. Initial JS is ~257 KB gzipped before any model
downloads.

**Fix:** lazy-import `ModelViewer` once `isImmersiveArSupported()` resolves false, or
render a lightweight three.js preview on the WebXR path.

---

## BUG-11 — AR failure message asserts one cause among several

**Severity:** Low · **Status:** CONFIRMED (static) · **File:** `ProductArExperience.tsx:60`

*"Couldn't start AR. Camera permission may be blocked."* — camera permission is one of at
least four causes (see BUG-03). Misdirects the user and generates avoidable support.

---

## BUG-12 — No test runner installed

**Severity:** Low · **Status:** CONFIRMED (static)

No vitest/jest/playwright in `package.json`. The pure modules (`trueScale`, `room`,
`fit`, `units`, `placement`) import nothing from the browser or three.js and are
trivially testable — this audit wrote and ran **21 tests against them in under an hour,
all passing**, using the project's own esbuild. Keeping those tests costs almost nothing
and locks in the behaviour the whole product depends on.

---

## Hypotheses tested and refuted

Recorded so they are not re-raised. All four looked like real defects on first reading.

### NAB-01 — `lowestHorizontal` is not stale across "Start over"

**Hypothesis:** `lowestHorizontal` (the running minimum used to identify the floor before
lock) would persist after `resetAll()`, so re-setting the floor after a mistake would be
biased by the old session.

**Checked:** it is reset to `Infinity` at `roomEngine.ts:462`, inside `resetAll()`.
**Refuted. No change needed.**

### NAB-02 — Non-zero model `min.y` does not cause floating or sinking

**Hypothesis:** raw models sit at wildly different heights — measured `Chair.glb` at
**+2.76 m** above origin, `Lamp.glb` at **+3.62 m**, `Sofa.glb` at **−0.38 m**. If the
engine placed by model origin, these would float or sink dramatically.

**Checked:** `roomEngine.ts:630` —
`model.position.set(-centre.x, -fitted.min.y, -centre.z)`, computed from the box *after*
scale and rotation are applied. Footprint is centred and the base is put exactly on
y = 0. **Refuted. Correctly handled.**

### NAB-03 — `+Z`-toward-camera facing is spec-correct

**Hypothesis:** `group.rotation.y = Math.atan2(camera.x - at.position.x, camera.z -
at.position.z)` aims the model's **+Z** at the viewer, which would show a spec-conformant
model back-on.

**Checked against glTF 2.0 §3.4, quoted verbatim:**
> *"glTF defines +Y as up, +Z as forward, and -X as right; the front of a glTF asset
> faces +Z."*

**Refuted — the code is right.** (The project's own note that *"the facing of a side-on
model is a guess"* remains true for the `swapWidthDepth` case, where +90° and −90° are
equally plausible. That is a known limit, not a defect.)

### NAB-04 — Anchors, surface filtering and tracking states are properly implemented

**Hypothesis:** carried over from the earlier (wrong-folder) audit, where none of these
existed.

**Checked in `roomEngine.ts`:**
- `t.hit?.createAnchor?.()` at line 531 — the spec-recommended
  `XRHitTestResult.createAnchor()`, with graceful degradation when unsupported.
- Lines 875–882: `frame.trackedAnchors?.has(this.anchor)` → `frame.getPose(anchor.anchorSpace, space)` → rewrite `room.matrix`. ARCore's corrections move the whole room together.
- Lines 930–941: surface classified from the hit pose's up-vector
  (`setFromMatrixColumn(world, 1)`), with floor/raised/below/wall thresholds — the
  documented approach, since the Hit Test spec provides no orientation filter.
- Lines 860–868: `frame.getViewerPose()` plus `pose.emulatedPosition` →
  `ok | limited | lost`, and drag is dropped on loss.

**Refuted on all counts. These are correctly built and should not be touched.**

---

## Fixes implemented and tests passed in this run

**Fixes implemented: none** — audit only, by request. Nothing in `src/`, `server/` or
`db/` was modified.

**Executed and passing:**

| Check | Result |
| ----- | ------ |
| `npx tsc --noEmit` (strict, `noUnusedLocals`) | **0 errors** |
| `npx vite build` | **PASS**, 1,771 modules, 6.99 s |
| 21 unit tests on `room.ts` / `fit.ts` / `trueScale.ts` | **21 passed, 0 failed** |
| Binary measurement of 10 GLBs | complete |

**Zero AR behaviour has been verified on a physical device.** A clean typecheck, a clean
build and 21 green tests do not tell you whether a sofa appears at 212 cm on a real
floor.
