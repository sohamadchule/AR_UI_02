# Akruti — AR Technical Research

**Date:** 2026-10-27
**Purpose:** establish what mobile-web AR can actually do today, from primary sources, so
roadmap decisions rest on documented capability rather than on what an SDK advertises.

### Evidence tags

| Tag | Meaning |
| --- | ------- |
| `[SPEC]` | Normative text in a W3C/Khronos specification. |
| `[OFFICIAL]` | Vendor's own technical documentation (Google, Apple, Khronos). |
| `[MEASURED]` | Verified by the author in this session. |
| `[THIRD-PARTY]` | Independent tracker (caniuse, MDN). |
| `[VENDOR CLAIM]` | Marketing assertion; methodology not disclosed. |
| `[INFERENCE]` | The author's reasoning, flagged as such. |

---

## 1. The platform split, stated plainly

`[THIRD-PARTY]` [caniuse: WebXR Device API](https://caniuse.com/webxr) —

| Browser | WebXR status |
| ------- | ------------ |
| Chrome for Android (156) | **Partial support** |
| **Safari on iOS (through 27.2)** | **Not supported** |
| Samsung Internet 12.0–30 | Partial support |
| Firefox for Android (158) | Disabled by default |
| Safari (desktop, 13–27.1 + TP) | Disabled by default |

Global: **75.97% partial support, 0% full support.**

`[INFERENCE]` The consequence for Akruti is structural, not incidental: **in-page WebXR AR
reaches Android Chrome and Chromium derivatives only.** Every iPhone customer gets the
`<model-viewer>` → Quick Look handoff, which leaves the retailer's page and runs Apple's
viewer. Any feature built on WebXR — room scanning, fit verdicts, multi-object layout,
depth occlusion — **exists for roughly half of a typical retailer's mobile traffic and
not the other half.**

This is the single most important constraint on the product roadmap, and it has no
workaround short of a native app or a commercial WebXR-on-iOS shim.

---

## 2. WebXR module-by-module reality

`[OFFICIAL]` Google's own [WebXR compared to ARCore](https://developers.google.com/ar/develop/webxr/arcore-comparison):

| ARCore capability | Chrome WebXR status |
| ----------------- | ------------------- |
| Hit Test | **Shipped** |
| Anchors | **Shipped** |
| Depth API | **Shipped** |
| **Plane Detection** | **Developer Trial** |
| Lighting Estimation | **Shipped** |
| Augmented Faces | Not available |
| Augmented Images | Not available |
| Instant Placement | Not available |

> **Plane detection is still a Developer Trial.** This single row invalidates a large part
> of the room-scanning design described in `claude/ar-room-scan-and-fit.md`. Floor extent,
> wall segments, wall↔wall distance and "outside the scanned floor" warnings all depend on
> plane detection. Building a *customer-facing promise* on a Developer Trial API is not
> defensible; building a *lab experiment* on it is fine.

### 2.1 Hit Test

`[SPEC]` [W3C WebXR Hit Test Module](https://www.w3.org/TR/webxr-hit-test-1/) — Working
Draft, 11 December 2025.

```webidl
dictionary XRHitTestOptionsInit {
  required XRSpace space;
  sequence<XRHitTestTrackableType> entityTypes;   // "point" | "plane" | "mesh"
  XRRay offsetRay;
};
```

Three facts that matter:

1. **Default `entityTypes` is `["plane"]`** when omitted. Akruti omits it, so it is
   implicitly plane-only — which is the right default.
2. **The result pose carries the surface normal.** The result's native origin defines a
   coordinate system *"whose Y axis represents the surface's normal vector at the
   intersection point."* When the device supplies no orientation, the UA *"SHOULD"* set
   the Y axis *"pointing up (towards negative gravity vector)."*
3. **There is no orientation filter in the spec.** `entityTypes` selects the entity
   *category*, never whether a plane is horizontal or vertical.

`[INFERENCE]` Therefore the only documented way to restrict placement to floors is to read
the hit pose's up-vector and reject it yourself. `ArScene` discards that orientation
(`setFromMatrixPosition` takes translation only), so it cannot filter — see
`ar-bug-report.md` BUG-03.

### 2.2 Anchors

`[SPEC]` [W3C WebXR Anchors Module](https://immersive-web.github.io/anchors/) — Editor's
Draft, 27 April 2026.

- Purpose: track *"changes to a particular three-dimensional pose"* as *"the system's
  understanding of the world changes"*; the system *"attempts to maintain the pose of the
  anchor as if it were fixed relative to the real world."*
- `XRFrame.createAnchor(pose, space)` → `Promise<XRAnchor>`.
- `XRHitTestResult.createAnchor()` → `Promise<XRAnchor>`, attached to the real-world
  object that was hit where the device supports it. **This is the call Akruti should be
  making.**
- On tracking loss there is no `trackableState` flag. The UA removes the anchor from
  `frame.trackedAnchors`, and *"MAY report that the pose is unlocatable for a time."*
  So: poll `frame.trackedAnchors` each frame; absence is the signal.
- `[THIRD-PARTY]` MDN compatibility data shows these APIs in **one engine only, Chrome
  85+**.

`[INFERENCE]` The spec never uses the word "drift", so do not quote it as saying anchors
fix drift. What it does say is that anchors receive the system's corrections and a raw
reference-space pose does not — which is the substantive point.

### 2.3 Depth Sensing

`[SPEC]` [W3C WebXR Depth Sensing Module](https://www.w3.org/TR/webxr-depth-sensing-1/) —
Working Draft, 25 August 2026.

- `depthTypeRequest`: `"raw"` (unprocessed) and `"smooth"` (runtime noise reduction) are
  both defined. **The preference "MAY be ignored by the user agent"** — it is a hint, so
  any UI claiming raw depth must report what was actually granted.
- `usagePreference`: `"cpu-optimized"` → `XRCPUDepthInformation`; `"gpu-optimized"` →
  `XRWebGLDepthInformation` (or `XRGPUDepthInformation` for WebGPU).
- `dataFormatPreference`: `"luminance-alpha"` and `"unsigned-short"` (16-bit uint),
  `"float32"`. UAs **must** support `luminance-alpha`; the others are optional.
- **No confidence image is exposed to the page.** The spec's only mention is an informative
  note that raw depth *is* often accompanied by confidence values, which the UA may use
  internally; invalid pixels simply return **depth 0**.
- No sensor technology is mandated. Depth *"may be created based on camera image and IMU
  sensors"*, so a time-of-flight sensor is **not** required.

`[INFERENCE]` The absence of a confidence image is why multi-frame voxel agreement (the
approach sketched in the project doc) is a reasonable substitute — that part of the design
was sound. It is simply not implemented.

### 2.4 Device reach

`[OFFICIAL]` [ARCore supported devices](https://developers.google.com/ar/devices):

- No total device count is published; the list is per-manufacturer, with a full CSV via
  Play Console.
- **"over 88% of active devices" support the Depth API, as of May 2026.** `[INFERENCE]`
  Read in context this is 88% of *ARCore-supported* active devices, not of all Android
  phones — treat it as a ceiling, not a floor.
- Certification requires passing checks on *"camera, sensors, design, and CPU
  performance"*, and the device must have shipped with the Play Store.
- ARCore on Android reaches apps through **Google Play Services for AR**, a separately
  installed and separately updated component.

`[INFERENCE]` That last point is the practical failure mode in India: a certified device
whose Play Services for AR is missing or mid-update will answer
`isSessionSupported("immersive-ar")` optimistically and then fail at `requestSession`.
This is exactly `ar-bug-report.md` BUG-06, and it is why the Scene Viewer fallback is not
optional.

---

## 3. glTF 2.0 — the dimensional contract

`[SPEC]` [Khronos glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), §3.4 *Coordinate System and Units*, quoted verbatim:

> *"glTF uses a right-handed coordinate system."*
> *"glTF defines +Y as up, +Z as forward, and -X as right; the front of a glTF asset faces +Z."*
> *"The units for all linear distances are meters."*
> *"All angles are in radians."*
> *"Positive rotation is counterclockwise."*

And §3.7.4: *"After applying the node's global transform, mesh vertex position values are
meters."*

Three consequences for Akruti:

1. **Metres are normative.** `ar-scale="fixed"` plus a correctly authored GLB does give
   true size. The approach is right.
2. **+Z is forward.** The in-page facing logic is spec-correct (`ar-bug-report.md`
   NAB-02). `[MEASURED]` The catalogue's Wayfair chair conforms — back at −Z, seat front
   to +Z.
3. **The spec cannot enforce itself.** `[INFERENCE]` Exports from SketchUp (inches/feet),
   3ds Max (system units), or Blender with unapplied scale routinely violate both the unit
   and the forward convention. A platform that onboards third-party assets must **verify**
   rather than trust — which is `ar-bug-report.md` BUG-07.

---

## 4. `<model-viewer>` — documented behaviour

`[OFFICIAL]` [modelviewer.dev documentation data](https://raw.githubusercontent.com/google/model-viewer/master/packages/modelviewer.dev/data/docs.json):

| Attribute | Default | Behaviour |
| --------- | ------- | --------- |
| `ar-modes` | `webxr scene-viewer quick-look` | Prioritised list. `webxr` runs in-browser, `scene-viewer` hands to Google's app, `quick-look` to iOS Quick Look. |
| **`ar-scale`** | **`auto`** | `auto` lets users pinch-resize. **`fixed` keeps the model at 100% scale.** |
| `ar-placement` | `floor` | `floor` or `wall`. With `wall`, the back of the bounding box sits against the wall. |
| `ios-src` | — | USDZ for Quick Look. **No longer required** — omitting it generates USDZ on the fly, but generated USDZ *"does not support animations"*. |
| `xr-environment` | — | Enables WebXR lighting estimation. Documented known issues: scenes *"too dark"*, *"sudden lighting updates"*, *"shiny materials appearing matte"*. |
| `ar-status` event | — | `not-presenting`, `session-started`, `object-placed`, `failed`. WebXR-only except `failed`. |
| `canActivateAR` | — | `true` if the current platform supports AR. |

Three notes for Akruti:

- Setting `ar-scale="fixed"` is correct and deliberate (the default would have allowed
  resizing). **The in-page WebXR path does the opposite** — see BUG-02. That inconsistency
  is a bug, not a design choice.
- `ar-placement` defaults to `floor`, which is right for most furniture and **wrong for
  the hanging lantern currently in the catalogue**. It needs a per-product attribute to
  drive it.
- `ios-src` can be dropped. The auto-generated USDZ is adequate for static furniture.

---

## 5. Academic and open-source references

Candidate reading, retrieved via search. `[INFERENCE]` Each should be read in full before
being cited in any customer-facing material; only the relevance is asserted here.

| Work | Why it matters |
| ---- | -------------- |
| *AR as an Evaluation Playground: Bridging Metric and Visual Perception of Computer Vision Models* — [arXiv:2508.04102](https://arxiv.org/html/2508.04102v2) | Directly addresses the gap between a metrically-correct render and what a user *perceives* — the core of "does it look like it fits". |
| *RASSAR: Room Accessibility and Safety Scanning in Augmented Reality* — [arXiv:2404.07479](https://arxiv.org/html/2404.07479v1) | Mobile room scanning and measurement in practice, including reported accuracy limits. Closest published work to the room-scan ambition. |
| *Enhancing User Experience of Interior Design Mobile AR* — [SCITEPRESS 2021](https://www.scitepress.org/Papers/2021/106304/106304.pdf) | Interior-design-specific AR UX study. |

`[INFERENCE]` A genuine gap: no independent, peer-reviewed measurement of **WebXR**
(as opposed to native ARKit/ARCore) furniture placement accuracy on mid-range Android was
located. If Akruti wants a defensible accuracy claim, it will have to generate that
evidence itself — which is a differentiator, not just a cost (see `ar-market-opportunity.md` §5).

Open-source AR measurement apps (ReMeasure and similar) were searched for but **no
authoritative repository with published accuracy figures was confirmed**. Recorded as
**unknown — insufficient evidence**, rather than guessed at.

---

## 6. What this means for the roadmap

| Capability | Documented status | Build now? |
| ---------- | ----------------- | ---------- |
| Hit-test placement | `[SPEC]` Shipped | **Yes — already built, needs surface filtering** |
| Anchors | `[OFFICIAL]` Shipped, Chrome 85+ | **Yes — P0, biggest single stability win** |
| Lighting estimation | `[OFFICIAL]` Shipped, with documented quality caveats | P1, measure before shipping |
| Depth sensing | `[OFFICIAL]` Shipped; >88% of ARCore devices | P2 — occlusion only, not fit logic |
| **Plane detection** | `[OFFICIAL]` **Developer Trial** | **P2 at best. Do not promise room scanning to customers on this.** |
| Mesh detection / room mesh | Not listed for Chrome | **No** |
| iOS in-page AR | `[THIRD-PARTY]` Not supported | **No** — Quick Look handoff is the only option |

**The honest summary:** Chrome Android can give you a correctly-scaled, properly-anchored,
floor-filtered, multi-object placement experience today, with good lighting and optional
occlusion. It cannot reliably give you room measurement, wall detection or automatic fit
verdicts — and iOS cannot give you an in-page experience at all.

Akruti should build the first list extremely well and stop claiming the second.
