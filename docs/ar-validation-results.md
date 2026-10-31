# Akruti — Validation Results (AR_UI_02)

**Run date:** 2026-10-27
**Environment:** sealed Linux cloud container. No phone, no camera, no GPU, no ARCore.

> **This records only what was executed.** Everything not run is listed in §3 as NOT RUN.
> No device behaviour is claimed as observed.

---

## 1. Executed

### 1.1 Build and type safety

| # | Check | Command | Result |
| - | ----- | ------- | ------ |
| V-01 | TypeScript, strict + `noUnusedLocals` + `noUnusedParameters` | `npx tsc --noEmit` | **PASS — 0 errors** |
| V-02 | Production build | `npx vite build` | **PASS — 1,771 modules, 6.99 s** |

Dependencies installed cleanly from the project's own `package.json`; no workarounds, no
shims, no network blocks. This corroborates the claim in `docs/ar-changes.txt` that
*"Typecheck … and production build … both pass."*

Bundle output:

```
dist/index.html                         2.48 kB │ gzip:   1.11 kB
dist/assets/index-*.css                73.98 kB │ gzip:  14.13 kB
dist/assets/ArScene-*.js               44.20 kB │ gzip:  14.47 kB
dist/assets/index-*.js                415.94 kB │ gzip: 120.77 kB
dist/assets/model-viewer-*.js         437.67 kB │ gzip: 136.18 kB
dist/assets/GLTFLoader-*.js           643.88 kB │ gzip: 165.85 kB
```

`ArScene` and `GLTFLoader` are correctly code-split behind the AR entry point.
`model-viewer` is not — logged as BUG-10.

> **What V-01 and V-02 prove about AR: nothing.** They prove internal consistency. They
> say nothing about whether a sofa appears at 212 cm on a real floor.

### 1.2 Unit tests against the project's real modules

Written for this audit, bundled with the project's own esbuild (`@` alias intact), run in
Node against the actual `src/lib` source. **21 passed, 0 failed.**

```
-- room.ts: SAT penetration --
  PASS identical boxes overlap
  PASS 1 m apart do not overlap
  PASS touching exactly = 0 overlap
  PASS 10 cm interpenetration measured
  PASS 45-deg neighbour at 1.2 m overlaps (diagonal reach)
  PASS 45-deg neighbour at 1.6 m clear

-- room.ts: nearest-point gap --
  PASS gap between 1 m boxes 2 m apart = 1.0 m
  PASS 0.4 m gap -> below WALKWAY 0.6

-- fit.ts --
  PASS 200x90 space -> too big
  PASS   and says 12 cm too wide
  PASS 220x100 space -> fits
  PASS no product dims -> unknown
  PASS no space -> unknown
  PASS narrow-but-deep space -> fits-turned

-- trueScale.ts --
  PASS sofa -> verified
  PASS 111 km chair rescued to verified
  PASS bookshelf detects swapWidthDepth
  PASS no dims + km-scale -> power-of-ten correction
  PASS 0.83 m chair is placeable
  PASS 687 km desk NOT placeable
  PASS 1 cm speck NOT placeable

21 passed, 0 failed
```

Notes on what these actually establish:

- **The 45° case matters.** A square rotated 45° reaches further along an axis than its
  width suggests. The test confirms the SAT implementation catches an overlap at 1.2 m
  that a naive axis-aligned check would miss, and correctly clears at 1.6 m. The rotation
  handling is real.
- **`fits-turned` works**, including the exact wording path ("12 cm too wide").
- **`trueScale` rescues a 111 km chair to `verified`** — this is the behaviour five of
  nine catalogue models depend on.
- **`isPlaceable` refuses the 687 km desk** that `docs/ar-market-comparison.txt` §3
  records as having actually appeared on a phone.

**No defects were found in `room.ts`, `fit.ts` or `trueScale.ts`.** These modules are
sound.

### 1.3 Asset measurement

Every catalogue GLB parsed from its binary chunks; world-space bounds computed from
accessor `POSITION.min`/`max` through the full node hierarchy.

| # | Check | Result |
| - | ----- | ------ |
| V-03 | All 10 GLBs valid glTF 2.0, correct magic, parseable | **PASS** |
| V-04 | World bounding boxes measured | Complete — `ar-product-model-audit.md` §1 |
| V-05 | `resolveTrueScale` ported exactly and run per product | **3 verified, 6 approximate** — matches `SOURCE.txt` |
| V-06 | Node matrix scales | No baked non-uniform scaling |
| V-07 | Double transform application | **None found** |
| V-08 | Base-at-origin | Raw models vary from −0.38 m to +3.62 m; **correctly compensated** at `roomEngine.ts:630` |
| V-09 | Triangle / texture budgets | `Sofa.glb` 282,111 tris + 3.91 MB textures; median elsewhere ~800 tris |
| V-10 | Provenance from embedded metadata + `SOURCE.txt` | 8 of 9 are CC-BY 3.0 Google Poly; `db/seed/models/chair-damask.glb` is Wayfair CC BY 4.0 |

### 1.4 Measured scale factors — the basis of BUG-01

Produced by running the project's own algorithm:

| Product | `trueScale` factor | Swap | Status |
| ------- | ------------------ | ---- | ------ |
| Mahal sofa | ×2.1115 | — | verified (3.8%) |
| Ira lounge chair | ×0.0000070 | — | verified (2.6%) |
| Grid bookshelf | ×0.0180 | **yes** | verified (2.8%) |
| Perch bar stool | ×1.0334 | — | approximate (14.1%) |
| Kaam writing desk | ×0.0000020 | — | approximate (20.3%) |
| Nook side table | ×0.0000010 | — | approximate (38.8%) |
| Alcove wardrobe | ×0.5544 | — | approximate (40.6%) |
| Sabha dining table | ×0.0000256 | — | approximate (53.0%) |
| Halo floor lamp | ×0.0000091 | — | approximate (85.4%) |

Any factor far from 1.0 is a product that is **badly wrong wherever `trueScale` is not
applied** — which is the iOS/Scene Viewer path. That is BUG-01, and this table is its
evidence.

### 1.5 Capability verification by exhaustive search

| Claim in `docs/ar-changes.txt` | Verified? | Evidence |
| ------------------------------ | --------- | -------- |
| "held by a WebXR anchor" | **Yes** | `createAnchor` at `roomEngine.ts:531`; `trackedAnchors` + `getPose(anchorSpace)` at 875–882 |
| "classed as floor / raised / wall" | **Yes** | hit-pose up-vector + thresholds, 930–941 |
| "tracking lost: placing and dragging stop" | **Yes** | `getViewerPose` + `emulatedPosition`, 860–868; `this.drag = null` |
| "Pinch-to-resize removed" | **Yes** | no pinch-scale path in `roomEngine.ts` or `ArScene.tsx` |
| "Taps were counted twice … cancelled (beforexrselect)" | **Yes** | `ArScene.tsx:111` |
| "Floor check … Now 15 cm" | **Yes** | `FLOOR_TOLERANCE = 0.15` |
| "Shadow map reduced from 2048 to 1024" | **Yes** | confirmed in engine setup |
| "error inside the per-frame loop … logs and keeps drawing" | **Yes** | `onFrame` try/catch, 848–856 |
| "Not done: automatic wall detection or a 3D room scan" | **Yes** | zero occurrences of `plane-detection` / `detectedPlanes` |
| Light estimation "not yet used" | **Yes** | requested in `webxr.ts:25`, `getLightEstimate` appears 0 times |
| Depth / occlusion "not yet used" | **Yes** | zero occurrences of `depth-sensing` / `getDepthInformation` |

**Every claim checked was accurate.** The project's own documentation is trustworthy —
which is worth stating, because it is unusual.

---

## 2. Hypotheses raised and refuted

Four. Full detail in `ar-bug-report.md`.

| # | Hypothesis | Outcome |
| - | ---------- | ------- |
| NAB-01 | `lowestHorizontal` stale after "Start over" | **Refuted** — reset at line 462 |
| NAB-02 | Non-zero model `min.y` causes floating/sinking | **Refuted** — compensated at line 630 |
| NAB-03 | `+Z`-toward-camera facing is 180° wrong | **Refuted** — glTF 2.0 §3.4 defines +Z as forward |
| NAB-04 | Anchors / surface filtering / tracking not implemented | **Refuted** — all three correctly implemented |

NAB-04 is the important one: it was carried over from an audit of the wrong repository.
Testing it is what caught the mistake.

---

## 3. NOT RUN

| Test | Why not |
| ---- | ------- |
| **All on-device AR testing** | No Android phone, no camera, no ARCore. **This is the bulk of what matters and none of it is validated.** |
| `npm run db:setup` / `db:seed:store` | No PostgreSQL instance provisioned for this audit |
| API integration tests | Requires the DB above |
| `npm run dev:tunnel` | Requires a tunnel and a phone |
| Browser rendering | No browser in the sandbox |
| Real-network model load timing | §1.3 figures are arithmetic from file size, **not measurements** |

---

## 4. What remains unknown about this system

1. **Whether a placed sofa measures 212 cm against a tape.** The engine is built to do it
   and the scale maths is verified; the end-to-end result on a phone is unproven.
2. **Whether anchoring holds across a room walk.** The implementation is correct by
   inspection. Actual drift in cm is unknown.
3. **Whether the floor lock survives real floors** — glossy tile, dark rugs, low light.
4. **Whether a 12.85 MB sofa is tolerable** inside a live AR session on 4G.
5. **Whether overlap and walkway warnings read as useful or as noise** with six of nine
   models at the wrong size.
6. **How often `isSessionSupported` → `requestSession` fails** on mid-range Indian
   Android. BUG-03 says the consequence is total loss of AR.
7. **What an iPhone visitor actually sees** for a product whose GLB is 111 km wide
   (BUG-01). Quick Look may refuse, show nothing, or clamp — unknown, and it should be
   checked on day one because it affects every iOS visitor.

The project's own `docs/ar-changes.txt` already contains a strong, specific device test
plan (sections A–G). It should be executed as written; `ar-test-plan.md` adds the
instrumentation and the gates.

---

## 5. Honest summary

**Passed:** typecheck, production build, 21/21 unit tests, 10/10 GLB parses.
**Confirmed defects:** 12, of which 1 is critical and 3 are high.
**Hypotheses refuted by testing:** 4.
**AR behaviour verified on a real device:** **zero.**

The correct reading: **the engine is well built and the pure logic is provably correct.
The catalogue is demo content, the iOS path is broken, and nothing has been measured on a
phone.** Those are three different problems and only the first one is solved.
