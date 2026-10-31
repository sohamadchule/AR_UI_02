# Akruti — Independent Technical Reassessment

**Date:** 2026-10-27
**Scope:** real-world dimensional accuracy and placement reliability.
**Method:** independent design first, then comparison against `C:\SohamAdchule\AR_UI_02`.
**Code changes made: none.**

**Evidence tags:** `[CODE]` verified in this repository, with file:line · `[DOC]` official
specification or vendor documentation, with URL · `[TEST]` executed in this session ·
`[DEVICE]` requires a physical phone — **not verified here** · `[INFER]` my reasoning.

---

## 1. Recommended architecture

### 1.1 The constraint that decides everything

The entry point is a **QR code**. A customer scanning a sticker on a showroom sofa will
not install an app. That single fact eliminates native ARCore/ARKit applications as the
primary delivery path, regardless of their technical superiority. `[INFER]`

Everything below follows from "web, no install."

### 1.2 Option evaluation

| Approach | Real 1:1 | Multi-object | Fit check | Android | iOS | Verdict |
| -------- | -------- | ------------ | --------- | ------- | --- | ------- |
| **A. Native ARCore + ARKit apps** | Best available | Yes | Yes | Yes | Yes | **Rejected** — install kills the QR funnel |
| **B. `<model-viewer>` only** (Scene Viewer / Quick Look) | Yes, if the asset is correct | **No** | **No** | Yes | Yes | **Insufficient alone** — both are single-object OS viewers that take over the screen. Meets objectives 1–4, fails 5–7. |
| **C. WebXR in-page** | Yes, full control | Yes | Yes | Yes | **No** | **Correct for Android.** Safari ships no WebXR `[DOC]` [caniuse](https://caniuse.com/webxr) — "Not supported" through iOS 27.2 |
| **D. Hybrid: C on Android, B on iOS, shared asset pipeline** | Yes | Android only | Android only | Yes | Degraded | **Recommended** |
| **E. Commercial WebXR-on-iOS shim** (Variant Launch, 8th Wall) | — | — | — | — | Partial | Only route to iOS parity without an app. Vendor dependency; evaluate later, not now. |

**My independent design converges on D — which is the architecture the project already
has.** I want to be explicit about that rather than manufacture a disagreement: at the
top level, the existing choice is correct and I would make it again.

**Where my design differs is one layer down, and it is the layer that is currently
broken.**

### 1.3 The one architectural change I recommend

> **Normalize the asset at ingest, not at render.**

Today the scale correction lives inside the WebXR renderer (`roomEngine.makeProduct`).
Every consumer that is not that renderer receives raw, unscaled geometry. `[CODE]`

Instead, at upload time: measure, reconcile against the declared dimensions, gate, and
emit a **canonical asset** — scale baked, base at y=0, footprint centred, front at +Z,
metres. Serve that. Runtime scale becomes identity.

This single change resolves six separate requirements at once:

| Requirement | How ingest-time normalization resolves it |
| ----------- | ----------------------------------------- |
| **(F) no double application** | **Impossible by construction** — runtime scale is 1.0. Not a convention to maintain, an invariant. |
| **(H) cross-platform consistency** | WebXR, Scene Viewer and Quick Look consume the same correct bytes |
| **(D) mixed units** | Handled once, server-side, where a human can see the result |
| **(E) disagreement detection** | Becomes a publish gate rather than a runtime notice |
| **(I) pinch cannot invalidate** | A pre-generated USDZ at a real URL makes `allowsContentScaling=0` reliable (§4.3) |
| Performance | No per-load correction on a mid-range phone |

It also matches what every incumbent does — a point the project's own
`docs/ar-market-comparison.txt` §2a already makes: *"Accuracy is mostly decided BEFORE
the customer opens AR."* That document reached the right conclusion; the code has not
caught up with it.

### 1.4 Component placement

**Server**
- GLB container validation and world-space bbox (**already built** — `db/scripts/glb.mjs:boundsOf`) `[CODE]`
- Dimensional reconciliation (**already built** — `src/lib/trueScale.ts`, needs to move server-side)
- **Publish gate:** block on deviation, size, triangles, implausible extents
- **Canonical GLB emitter** (new)
- **USDZ emitter** for iOS (new)
- Catalogue, dimensions, versioned assets (**already built**)

**Device**
- Android: WebXR session, hit-test, anchors, placement, multi-object, overlap, room tools (**already built** — `roomEngine.ts`)
- iOS: `<model-viewer>` → Quick Look with a pre-generated USDZ
- Both: fit check against user-entered space (**already built** — `fit.ts`), which needs no AR at all

---

## 2. The dimensional pipeline

### A. Where authoritative dimensions come from

**The retailer's specification, entered once, stored as integer millimetres. Never
derived from the model.** The model is *evidence*; the catalogue is *truth*.

Already correct: `product.width_mm / depth_mm / height_mm` `[CODE]`
`db/migrations/0001_init.sql`, surfaced as `product.dimensionsMm` `[CODE]`
`server/catalog.mjs:toPublic`.

**Missing:** provenance. Add `dimension_source ∈ {MEASURED_PHYSICAL, MANUFACTURER_SPEC,
ESTIMATED, UNKNOWN}`, plus who verified it and when.

### B. Verified vs estimated — two independent axes

These are routinely conflated and must not be:

1. **Provenance of the declared numbers** — did someone put a tape on the real sofa, or
   copy a spec sheet, or guess? (`dimension_source`)
2. **Agreement between declared and model** — does the geometry match? (`trueScale`
   status: `verified` / `approximate` / `no-dimensions`)

The system currently has (2) and not (1). A product can be `verified` against a
`GUESSED` number — geometry that faithfully reproduces a wrong dimension. **Only
`MEASURED_PHYSICAL` or `MANUFACTURER_SPEC` + `verified` earns a "real size" claim.**

### C. Inspecting the GLB

Traverse the default scene; compose node matrices (`matrix`, or TRS); transform the 8
corners of each primitive's `POSITION` accessor `min`/`max`; accumulate a world AABB.
`POSITION` accessors are required by spec to carry `min`/`max`, so this needs no vertex
decoding. `[DOC]` glTF 2.0

**Already implemented correctly** in `db/scripts/glb.mjs:boundsOf` — and independently
reimplemented and cross-checked during this audit; both agree. `[TEST]`

Documented limitations to record rather than fix now `[INFER]`:
- Skinned meshes: accessor bounds are bind-pose.
- Morph targets: extents can exceed the base accessor bounds.
- Animations: a model that moves can exceed its static AABB.
- Sparse accessors: `min`/`max` still describe the final data.
- Draco/`KHR_mesh_quantization`: JSON `min`/`max` remain authoritative.

None of these affect static furniture. Note them so the first animated SKU does not
produce a silent error.

### D. Mixed units

glTF is unambiguous — `[DOC]` glTF 2.0 §3.4:

> *"The units for all linear distances are meters."*
> *"glTF defines +Y as up, +Z as forward, and -X as right; the front of a glTF asset faces +Z."*

Scene Viewer restates it: *"1 unit = 1 meter"*, right-handed, +Y up, front +Z. `[DOC]`
[Scene Viewer](https://developers.google.com/ar/develop/scene-viewer)

Exports violate it constantly. **Measured in this catalogue: 5 of 9 models are authored
at ~10⁻⁶ of real scale** (one chair is 111 km wide). `[TEST]`

The correct handling is not unit *guessing* — it is **ratio to the declared
dimensions**, which yields the exact factor whatever the authoring unit was. Power-of-ten
snapping is the fallback used only when no dimensions are declared. This is exactly what
`resolveTrueScale` does, and it is the right design.

### E. Detecting disagreement

Compute per-axis ratios `declared_m / model_axis`. If they agree within tolerance, one
uniform factor reproduces the product — scale it. If they disagree, **the model is not
the product** (or its axes are permuted).

Permutations: for upright furniture with +Y up, the only plausible permutation is
width↔depth. Testing just that case is correct and avoids false matches from an
exhaustive permutation search. `resolveTrueScale` does precisely this. `[INFER]`

**The rule the brief states — never non-uniformly stretch a model to force a match — is
already honoured:** `bestFactor` returns a single scalar (the median ratio), never
per-axis scales. `[CODE]` `src/lib/trueScale.ts`

What should change is the *consequence*. Today `approximate` publishes with a notice.
**It should block publication.** A 152 cm floor lamp drawn at 82 cm is not a labelling
problem; it is a wrong answer that then feeds the fit and clearance maths.

### F. Preventing double application

Three layers, in order of strength:

1. **Structural (primary):** normalize at ingest; runtime scale is identity. Double
   application becomes unrepresentable.
2. **Marking:** stamp `asset.extras.akruti = { normalized: true, factor, pipelineVersion }`
   in the canonical GLB. Re-ingesting a normalized file is then detectable.
3. **Assertion:** a CI test that measures the canonical asset and asserts the derived
   factor is `1.000 ± 0.002`. Any future regression that re-applies a correction fails
   here, with no device needed.

### G. Preserving dimensions through interaction

- Product lives in a group whose **scale is never touched by any interaction handler**.
  Movement mutates position (XZ) and yaw only.
- Anchors supply a **rigid** room→world transform. `XRAnchor` poses are rigid by spec —
  rotation and translation only, no scale — so anchoring cannot corrupt size. `[DOC]`
  [W3C Anchors](https://immersive-web.github.io/anchors/)
- No ancestor of the product may carry non-unit scale. Worth a dev-mode assertion walking
  `object.parent` chain.
- Verified in the current code: interaction touches `group.position` and
  `group.rotation.y`; the scale is applied once in `makeProduct` and never afterwards.
  `[CODE]` `roomEngine.ts:490–507, 591–631`

### H. Cross-platform behaviour

**Verified at source level.** `ar-scale="fixed"` maps to: `[DOC]`
[model-viewer `ar.ts`](https://raw.githubusercontent.com/google/model-viewer/master/packages/model-viewer/src/features/ar.ts)

```ts
// Scene Viewer
if (this.arScale === 'fixed') { params.set('resizable', 'false'); }

// Quick Look
if (this.arScale === 'fixed') {
  if (modelUrl.hash) modelUrl.hash += '&';
  modelUrl.hash += 'allowsContentScaling=0';
}

// model-viewer's own WebXR
this[$scene].canScale = this.arScale !== 'fixed';
```

> **This is the crux of the whole reassessment.** `ar-scale="fixed"` **applies no scale
> whatsoever.** It only prevents the *user* from resizing. The displayed size comes
> entirely from the file's geometry.
>
> So on a model authored at 10⁻⁶ scale, `ar-scale="fixed"` faithfully locks the chair at
> **111 kilometres**. The attribute is working exactly as documented; it was never a
> dimension mechanism.

Target behaviour once the asset is canonical:

| | WebXR (Android Chrome) | Scene Viewer (Android) | Quick Look (iOS) |
| --- | --- | --- | --- |
| Correct 1:1 size | Yes | Yes | Yes |
| User cannot resize | Yes (no pinch in engine) | Yes (`resizable=false`) | Best-effort (§4.3) |
| Multiple objects | **Yes** | No | No |
| Overlap / clearance | **Yes** | No | No |
| Room measurement | **Yes** (guided) | No | No |
| Fit check | Yes (and works with no AR at all) | n/a | n/a |
| Custom UI | Yes | No | No |

**Do not promise parity.** Objectives 5 and 6 are Android-only on the web, and the iOS
product page should say so plainly rather than silently offering less.

### I. Pinch cannot silently invalidate the claim

- **WebXR:** pinch-to-resize is already removed. `[CODE]` If ever reintroduced, it must
  display live centimetres, a persistent "not actual size" badge, and a one-tap reset.
- **Scene Viewer:** `resizable=false`. Documented default is `true`, so the attribute is
  load-bearing. `[DOC]`
- **Quick Look:** `allowsContentScaling=0` is appended to the USDZ URL **fragment**. With
  model-viewer's auto-generated USDZ the URL is a **Blob**, and Safari historically
  dropped fragment parameters on Blob URLs (WebKit 236069); maintainers discussed
  disabling the feature, and a user reported it working again in iOS 15.5. `[DOC]`
  [model-viewer discussion #3510](https://github.com/google/model-viewer/discussions/3510)

  **Therefore: serve a pre-generated USDZ from a real URL via `ios-src`.** It removes the
  dependency on a Safari Blob-URL bug, makes scale-lock reliable, and avoids
  auto-generation's documented inability to carry animations.

  Until confirmed on a device `[DEVICE]`, **the UI must not claim locked 1:1 on iOS.**

### J. Three measurement domains that must not be conflated

| Domain | Unit | Source | Error |
| ------ | ---- | ------ | ----- |
| 1. Product dimensions | mm | Catalogue | 0 by definition (but see §2B) |
| 2. Rendered extents | m, room frame | Derived from 1 | Normalization + tracking |
| 3. Room geometry | m, room frame | User-measured in AR | Tracking + user aim — **the noisiest** |
| 4. Clearance | m | Derived from 2 and 3 | **Sum of both** |

**A clearance figure is never more accurate than the room measurement it rests on.**
Report it with a tolerance and round to 5 cm; do not print "37 cm" and imply millimetres.

Note the project already gets the most important part right: `fit.ts` compares domain 1
against **user-entered tape measurements**, not against the AR room scan. That path has
*no AR error at all* and is the most trustworthy fit answer in the product. It is also
the only objective-6 feature that works on iOS. `[CODE]`

---

## 3. Most reliable way to maintain 1:1 scale

In descending order of strength:

1. **Make the asset correct.** A canonical GLB in metres needs no runtime correction and
   cannot be got wrong by a consumer that does not know about Akruti's scale logic.
2. **Gate at ingest.** Refuse to publish a model that disagrees with its declared size.
3. **Make runtime scale identity**, and assert it in CI.
4. **Lock user scaling on every path**, and where it cannot be guaranteed (iOS), do not
   claim it.
5. **Measure on devices** and publish the error. Nothing above proves real-world accuracy.

---

## 4. Android vs iOS — the real differences

### 4.1 Capability

`[DOC]` [Google: WebXR compared to ARCore](https://developers.google.com/ar/develop/webxr/arcore-comparison)
— Chrome WebXR: Hit Test **Shipped**, Anchors **Shipped**, Depth **Shipped**, Lighting
Estimation **Shipped**, **Plane Detection: Developer Trial**, Instant Placement: not
available.

iOS Safari: no WebXR at all. `[DOC]` caniuse. The only in-page option is a commercial
shim (§1.2 E) or a native app.

### 4.2 Consequence

Android gets the product. iOS gets single-object placement at the correct size. That gap
is a platform fact, not an implementation gap, and it should be stated to retailers
rather than papered over.

### 4.3 Scale-lock reliability

Android Scene Viewer: `resizable=false`, documented, deterministic.
iOS Quick Look: `allowsContentScaling=0` via URL fragment, reliable **only with a real
URL**, which requires pre-generating the USDZ. `[DOC]`

---

## 5. Independent reassessment of the existing implementation

### 5.1 Re-verification of the earlier iOS finding

The brief asked me to recheck this rather than trust the previous pass. I traced it from
three independent directions:

1. `[CODE]` `src/features/experience/ModelStage.tsx:26` — `src={variant.model.url}`
2. `[CODE]` `server/catalog.mjs:toPublic` — `url: /api/models/${row.sha256}`,
   content-addressed by the hash of the **original uploaded bytes**
3. `[CODE]` `server/catalog.mjs:getModelBlob` — returns `b.content`. **No transform
   anywhere in the serve path.**
4. `[CODE]` `src/features/experience/ModelViewer.tsx:280–301` — `src` passed straight to
   `<model-viewer>`; no scale attribute exists on the element
5. `[DOC]` model-viewer `ar.ts` — `ar-scale` sets `resizable` / `allowsContentScaling` /
   `canScale` and **never scales the model**

**Confirmed, and the mechanism is now precise:** the scale correction exists only inside
`roomEngine.makeProduct`. `[CODE]` `roomEngine.ts:591` Every other consumer —
Quick Look, Scene Viewer, model-viewer's own WebXR, and any future thumbnail or
third-party embed — gets raw geometry.

Measured impact, using the project's own algorithm `[TEST]`:

| Product | WebXR | iOS / Scene Viewer |
| ------- | ----- | ------------------ |
| Mahal sofa | 212 cm | 100 cm |
| Ira lounge chair | 78 cm | **111 km** |
| Sabha dining table | 122 cm | **47.7 km** |
| Nook side table | 67 cm | **530 km** |
| Kaam writing desk | 140 cm | **687 km** |
| Grid bookshelf | 180 cm, turned | 18 m, un-turned |
| Alcove wardrobe | 202 cm | 364 cm |
| Perch bar stool | 36 cm | ~35 cm ✓ |
| Halo floor lamp | 41 cm | **44 km** |

**1 of 9 is approximately right on iOS.** `[DEVICE]` What Quick Look actually does with a
111 km model — refuse, blank, or clamp — is unverified and should be checked first.

### 5.2 New architectural finding

The model URL is `/api/models/<sha256>` — keyed by the **asset**. Declared dimensions are
keyed by the **product**. The schema explicitly permits sharing: `[CODE]`
`db/migrations/0001_init.sql:110` — *"A blob can be shared by assets."*

So **normalization must not mutate the source blob.** Two products could legitimately
share one source GLB with different declared sizes.

**Clean fix that preserves the existing design:**

```sql
ALTER TABLE model_asset
  ADD COLUMN normalized_sha256 char(64) REFERENCES model_blob (sha256),
  ADD COLUMN normalization     jsonb;   -- { factor, swap, status, deviation, sourceBbox, targetMm, pipelineVersion }
```

Serve `normalized_sha256`. Keep the original for provenance and re-derivation.
Content-addressing and deduplication both still work: identical source + identical
declared dimensions produce identical normalized bytes, hence the same hash.

Two schema constraints to adjust for the USDZ path: `model_blob` has a
`CHECK (substring(content FROM 1 FOR 4) = '\x676c5446')` (GLB magic) and `model_asset`
has `CHECK (content_type = 'model/gltf-binary')`. `[CODE]` A USDZ needs either a relaxed
constraint or a sibling table.

### 5.3 Component-by-component

| Component | Verdict | Evidence |
| --------- | ------- | -------- |
| `trueScale.ts` | **Meets requirements. Keep the algorithm; move the call server-side.** Uniform scalar only, median ratio, width↔depth permutation, placeability bounds. | `[TEST]` 7/7 tests pass, incl. 111 km rescue and side-on bookshelf |
| `room.ts` | **Meets requirements. Keep unchanged.** Correct SAT with rotation, nearest-point polygon distance. | `[TEST]` 8/8 pass, incl. the 45°-rotation case a naive AABB would miss |
| `fit.ts` | **Meets requirements. Keep unchanged.** Never resizes; `fits-turned` works; the only objective-6 feature that works on iOS. | `[TEST]` 6/6 pass |
| `placement.ts` | **Partially meets.** Regex over the product name. Works for the current 9; brittle for retailer-supplied names. | `[CODE]` |
| `roomEngine.ts` | **Meets requirements.** Anchors via `XRHitTestResult.createAnchor()`; per-frame `trackedAnchors` + `getPose(anchorSpace)`; surface classification from the hit pose normal; tracking via `getViewerPose` + `emulatedPosition`; grounding via `-fitted.min.y`; `beforexrselect` double-tap fix; try/catch frame loop. | `[CODE]` 531, 875–882, 930–941, 860–868, 630, `ArScene.tsx:111`, 848–856 |
| GLB ingest (`glb.mjs`) | **Partially meets.** Correct bbox already computed; no quality gate; `MAX_GLB_MB = 50` vs a ~5 MB budget. | `[CODE]` `server/admin.mjs:15` |
| **Serve path** | **Confirmed defect.** No normalization. §5.1 | `[CODE]` |
| **iOS path** | **Confirmed defect.** Raw geometry + auto-generated Blob USDZ. | `[CODE]`, `[DOC]` |
| WebXR failure fallback | **Confirmed defect.** `showArButton={webXrSupported === false}`; a `requestSession` rejection leaves no AR path. | `[CODE]` `ProductArExperience.tsx:52–61, 70–76` |
| Catalogue content | **Confirmed defect.** 6 of 9 models render 14–85% wrong; all 9 are demo assets. | `[TEST]` |
| Automated testing | **Missing.** No runner installed. | `[CODE]` `package.json` |
| Device validation | **Missing.** `docs/ar-changes.txt` has a good plan; no results recorded. | — |

### 5.4 Architectural limitations (not defects)

- **No iOS multi-object or room tools.** Platform, not code.
- **No automatic wall detection.** Plane detection is Developer Trial. `[DOC]` The
  project's choice of guided corner-tapping is the correct ceiling and should be kept.
- **Fit answers inherit room-measurement error.** §2J.

---

## 6. Measurable acceptance criteria

| # | Criterion | Threshold | How verified |
| - | --------- | --------- | ------------ |
| **A1** | Declared vs model agreement (publish gate) | **≤2% warn, >5% block** | `[TEST]` automated at ingest |
| **A2** | Canonical asset is identity-scaled | factor `1.000 ± 0.002` | `[TEST]` CI |
| **A3** | **Rendered width vs tape** | **±3%, or ±2 cm, whichever greater** | `[DEVICE]` |
| **A4** | Scale consistency across viewing distance | within 2% across 1 m / 2 m / 3 m | `[DEVICE]` |
| **A5** | Floor placement | base within ±2 cm of the floor; no visible gap or sink at 1 m | `[DEVICE]` |
| **A6** | Orientation | yaw within ±5° of intended facing | `[DEVICE]` |
| **A7** | Static drift | <1 cm over 60 s stationary | `[DEVICE]` |
| **A8** | Loop drift | **<5 cm after a 15 m walk and return** | `[DEVICE]` |
| **A9** | Room measurement | ±3% or ±5 cm per wall, whichever greater | `[DEVICE]` |
| **A10** | Clearance reporting | reported with tolerance, rounded to 5 cm | `[CODE]` |
| **A11** | Model load | <5 MB; first paint <3 s at 8 Mbps | `[DEVICE]` |
| **A12** | Cross-device consistency | same product within 2% across 3 phones | `[DEVICE]` |
| **A13** | iOS size parity | iOS matches Android within 3% | `[DEVICE]` |

A3 is justified against the only published figure in this market — IKEA's own *"98% scale
accuracy"* claim `[DOC]`, which is a vendor claim with no methodology. Third-party
guidance treats these tools as fit checks, **not measurement tools**. `[DOC]` Akruti
should adopt the same honest positioning.

### Physical validation procedure

Per device, per product. Tape measure required.

1. **Reference.** Tape a 2.00 m line on the floor. Photograph it.
2. **Ruler cross-check first.** Measure the tape with the in-app ruler. Record the error.
   *This separates model error from tracking error* — if the sofa and the ruler are off by
   the same amount, the fault is the phone, not the pipeline. (This idea is already in
   `docs/ar-changes.txt` §A and is the single smartest test in that document.)
3. **Place** the Mahal sofa with one end on the start mark, width along the tape.
4. **Measure** the rendered far end against the tape. Record in cm. Expect 212 ± 6 cm.
5. **Repeat** standing at 1 m, 2 m, 3 m.
6. **Walk test.** Mark the footprint corners with tape. Walk a 15 m loop out of the room
   and back. Measure displacement. Record cm.
7. **Static test.** Hold still 60 s. Record any creep.
8. **Surfaces.** Repeat on plain floor, patterned rug, glossy tile. Record time to floor
   lock and any failures.
9. **iOS.** Same product, same measurement, via Quick Look. Record the size **and whether
   pinch is locked**.
10. **Repeat on three Android devices**, one of which must be mid-range 2–3 years old.

Record device model, Android version, Chrome version, **Google Play Services for AR
version**, lighting, floor type, and network. A row without numbers is a failed test, not
a blank.

> Unit tests, a clean build and a convincing screenshot are **not** evidence of
> real-world accuracy. This session ran 21 unit tests (all passing), a clean typecheck and
> a clean production build, and **none of them tell you whether a sofa measures 212 cm on
> a floor.**

---

## 7. Continue / refactor / rebuild

| Criterion | A. Continue as-is | **B. Refactor selected components** | C. Rebuild on a different approach |
| --------- | ----------------- | ----------------------------------- | ---------------------------------- |
| Dimensional accuracy | **Fails** — iOS/Scene Viewer unscaled | **Correct on all paths** | Correct, eventually |
| Placement reliability | Already good on Android | Unchanged (already good) | Rebuilt and re-proven from zero |
| Android compatibility | Good | Good | Risk of regression |
| iOS compatibility | **Broken** | Correct size; single-object | Only parity via native app or shim |
| Multiple objects | Works (Android) | Unchanged | Must be rebuilt |
| Room measurement / fit | Works | Unchanged | Must be rebuilt |
| Complexity | None | **Low — additive ingest stage** | Very high |
| Maintainability | Correction trapped in the renderer | **Single point of truth** | Unknown |
| Testing burden | — | Ingest tests + the existing 21 + device suite | Everything, from scratch |

**Rebuilding is not justified.** The expensive, hard-won parts — anchoring, surface
classification, tracking states, multi-object management, SAT overlap, guided room
measurement — are implemented correctly and verified as far as they can be without a
device. A rebuild would discard proven work to re-solve solved problems, and the defect it
would be aimed at does not live there.

**Continuing is not acceptable,** because the product's central claim is false on every
iPhone.

---

## 8. Highest-priority technical problems

1. **The serve path applies no normalization**, so iOS and Scene Viewer get raw geometry.
   8 of 9 products wrong, 5 of them by orders of magnitude. `[CODE]` `[TEST]`
2. **Six of nine catalogue models disagree with their declared dimensions by 14–85%**,
   and publish anyway. Their rendered footprints then feed the overlap, clearance and fit
   maths. `[TEST]`
3. **No publish gate at ingest.** `MAX_GLB_MB = 50`; no shape, triangle or texture check.
   `[CODE]`
4. **A failed WebXR session offers no AR at all** — on precisely the mid-range Android
   stock most likely to fail. `[CODE]`
5. **iOS scale-lock depends on a Safari Blob-URL bug.** Needs a pre-generated USDZ.
   `[DOC]`
6. **`Sofa.glb` is 12.85 MB / 282k triangles**, downloaded inside a live AR session.
   `[TEST]`
7. **Zero device measurements exist.** Every accuracy statement about this system,
   including mine, is currently unproven. `[DEVICE]`

---

## 9. Phased plan

### Phase 0 — Instrument (days)
Add a test runner; keep the 21 existing tests. Add the `?debug` overlay (granted XR
features, tracking state, anchored, drawn vs listed size). **No behaviour change.**
*Exit: CI green; a device run produces numbers.*

### Phase 1 — Canonical asset pipeline
Move `resolveTrueScale` server-side. Emit a canonical GLB (scale baked, base y=0,
footprint centred, `extras.akruti` stamped). Add `normalized_sha256` + `normalization`.
Serve normalized. Set runtime scale to identity. Add the A2 invariant test.
*Exit: A1, A2 pass; BT — fetch the served GLB, parse it, assert its bbox equals the
declared size.*

### Phase 2 — iOS parity of size
Generate a USDZ at ingest; serve via `ios-src` from a real URL. Relax the `model_blob`
GLB-magic and `content_type` constraints or add a sibling table.
*Exit: A13 on a device; pinch-lock confirmed or the claim withdrawn.*

### Phase 3 — Gate
Block publish on >5% deviation, >5 MB, >150k triangles, implausible extents, or missing
dimensions. Add `dimension_source`. Show the admin the AR-size preview before publish.
*Exit: today's catalogue — 6 of 9 blocked. That is the gate working.*

### Phase 4 — Content
Replace the six failing models. Compress `Sofa.glb` under 5 MB. Record hours per model.
*Exit: all published products `verified` + `MANUFACTURER_SPEC` or better.*

### Phase 5 — Resilience
Scene Viewer fallback on `requestSession` rejection; `visibilitychange`; load timeout with
a "continue in 3D" escape.

### Phase 6 — Physical validation
Full §6 procedure. Three Android phones + one iPhone. **Publish the numbers.**
*Exit: A3–A13.*

---

## 10. Criteria for claiming "correct real-world dimensions"

All of these, simultaneously. Any one failing retracts the claim.

| | Criterion |
| - | --------- |
| **C1** | `dimension_source` is `MEASURED_PHYSICAL` or `MANUFACTURER_SPEC` — **not** `ESTIMATED` |
| **C2** | `trueScale` status is `verified` (≤5% worst axis); `approximate` cannot be published |
| **C3** | The **served** asset measures the declared size: derived factor `1.000 ± 0.002` |
| **C4** | Every delivery path consumes that asset — WebXR, Scene Viewer, Quick Look |
| **C5** | User resizing locked on every path, or the claim is qualified for that path |
| **C6** | **A3 passes on ≥3 Android devices**, one mid-range: rendered width within ±3% of a tape |
| **C7** | A13: iOS within 3% of Android |
| **C8** | A8: <5 cm drift after a 15 m loop |
| **C9** | The measured numbers are **recorded and published**, not asserted |
| **C10** | Clearance and fit figures carry their tolerance |

**Today: C1 ✗, C2 ✗ (6 of 9), C3 ✗, C4 ✗, C5 partial, C6–C9 unmeasured.**
C10 is partly met — `fit.ts` is honest, clearance is not.

---

## Final recommendation

> ## Refactor selected components.

**Keep unchanged:** `room.ts`, `fit.ts`, `units.ts`, and the whole of `roomEngine.ts` —
anchoring, surface classification, tracking states, grounding, multi-object management,
guided room measurement. These are correctly built and independently verified.

**Keep the algorithm, move the call:** `trueScale.ts` to ingest.

**Add:** canonical GLB emitter, USDZ emitter, publish gate, `normalized_sha256`,
`dimension_source`, test runner, device validation.

**Replace:** the six failing models; `placement.ts`'s name regex with a DB column.

**Do not rebuild.** The evidence does not support it. The engine is not the problem: it
anchors correctly `[CODE]`, classifies surfaces from the hit-pose normal as the spec
requires `[CODE]` `[DOC]`, handles tracking loss `[CODE]`, and its geometry passed 21 of
21 tests `[TEST]`. The defect is that **a correctly-computed scale is applied in the wrong
layer** — inside one renderer instead of to the asset every renderer shares. That is a
plumbing fix measured in days, not an architecture to discard.

**One caveat on my own confidence:** everything above is static analysis, binary
measurement, specification reading and headless testing. **No AR session has been run on a
phone.** The architecture can be judged from here; the accuracy cannot. Phase 6 is not
optional — it is the only step that converts this from a defensible design into a
substantiated claim.

**No code has been changed. Awaiting your approval before any implementation.**
