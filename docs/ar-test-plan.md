# Akruti — Test Plan (AR_UI_02)

**Date:** 2026-10-27

The project already has a good device test script in `docs/ar-changes.txt` sections A–G.
**Do not replace it — run it.** This document adds the three things it is missing: an
automated layer that runs on every commit, instrumentation so device runs produce numbers
instead of impressions, and explicit gates.

| Layer | Runs | Needs | Catches |
| ----- | ---- | ----- | ------- |
| 1. Unit | every commit | Node only | scale, fit, overlap, gap maths |
| 2. Asset gate | every upload + CI | Node only | wrong size, oversized, wrong shape |
| 3. API / DB | every commit | Node + Postgres | auth, versioning, model streaming |
| 4. Browser | every PR | headless Chromium | pages render, fallbacks, **BUG-01** |
| 5. **Device** | **every release** | **real Android phones** | **everything that matters** |

> Layers 1–4 all pass today on a build where six of nine products are the wrong size and
> every iPhone sees a 111 km chair. Only layer 5 and the asset gate catch those.

---

## Layer 1 — Unit tests (ready to adopt)

No test runner is installed (BUG-12). The pure modules import nothing from the browser or
three.js, so this is cheap: `npm i -D vitest`, then `npx vitest`.

**The 21 tests below were written and run during this audit — all passed.** Save as
`src/lib/__tests__/geometry.test.ts` and change `console.log`/`ok` to `expect`.

```ts
import { corners, penetration, nearest, WALKWAY, COMPANION_GAP, type Footprint } from '@/lib/room';
import { checkFit } from '@/lib/fit';
import { resolveTrueScale, isPlaceable } from '@/lib/trueScale';

const fp = (x: number, z: number, w: number, d: number, yaw = 0, bottom = 0, top = 0.8): Footprint =>
  ({ x, z, width: w, depth: d, yaw, bottom, top });

// --- room.ts: separating-axis overlap -------------------------------------
penetration(corners(fp(0,0,1,1)), corners(fp(0,0,1,1)))      // > 0   identical boxes overlap
penetration(corners(fp(0,0,1,1)), corners(fp(2,0,1,1)))      // <= 0  1 m apart, clear
penetration(corners(fp(0,0,1,1)), corners(fp(1,0,1,1)))      // ~ 0   exactly touching
penetration(corners(fp(0,0,1,1)), corners(fp(0.9,0,1,1)))    // 0.1   10 cm interpenetration
// rotation must matter: a 45-deg square reaches further along the axis
penetration(corners(fp(0,0,1,1)), corners(fp(1.2,0,1,1,Math.PI/4)))  // > 0
penetration(corners(fp(0,0,1,1)), corners(fp(1.6,0,1,1,Math.PI/4)))  // <= 0

// --- room.ts: nearest-point gap -------------------------------------------
nearest(corners(fp(0,0,1,1)), corners(fp(2,0,1,1))).distance   // 1.0
nearest(corners(fp(0,0,1,1)), corners(fp(1.4,0,1,1))).distance // 0.4 -> COMPANION_GAP < d < WALKWAY

// --- fit.ts ----------------------------------------------------------------
const sofa = { width: 2120, depth: 880, height: 760 };
checkFit(sofa, { width: 2000, depth: 900,  height: null }).status  // 'too-big', "12 cm too wide"
checkFit(sofa, { width: 2200, depth: 1000, height: null }).status  // 'fits'
checkFit(null, { width: 2200, depth: 1000, height: null }).status  // 'unknown'
checkFit(sofa, { width: null, depth: null, height: null }).status  // 'unknown'
checkFit(sofa, { width: 900,  depth: 2200, height: null }).status  // 'fits-turned'

// --- trueScale.ts ----------------------------------------------------------
resolveTrueScale({width:1.004,height:0.356,depth:0.433}, {width:2120,height:760,depth:880})     // verified
resolveTrueScale({width:111013,height:137411,depth:115924}, {width:780,height:940,depth:820})   // verified (111 km rescue)
resolveTrueScale({width:18.14,height:100,depth:100}, {width:1800,height:1850,depth:320})        // swapWidthDepth === true
resolveTrueScale({width:1200,height:900,depth:600}, null)                                       // 'no-dimensions', scale < 1
isPlaceable({width:0.83,height:0.69,depth:0.57})                 // true
isPlaceable({width:686929,height:347659,depth:400026})           // false  (the 687 km desk)
isPlaceable({width:0.01,height:0.01,depth:0.01})                 // false
```

**Add these three, which cover defects this audit found:**

| ID | Test | Guards |
| -- | ---- | ------ |
| UT-22 | Every seeded product's model resolves to `verified` | BUG-02 — fails today for 6 of 9, which is the point |
| UT-23 | Streamed GLB root-node scale equals the expected `trueScale` factor | **BUG-01** — the iOS fix |
| UT-24 | `placementOf()` for every seeded product name | BUG-06 |

---

## Layer 2 — Asset quality gate

`server/admin.mjs` validates the GLB *container* but nothing about its quality, and
`MAX_GLB_MB = 50` (BUG-05). Run `resolveTrueScale` at upload and apply:

| Rule | Threshold | Action |
| ---- | --------- | ------ |
| Shape deviation vs entered dimensions | > 5% | **block**, show both sizes |
| | 2–5% | warn |
| File size | > 5 MB | **block** |
| Triangles | > 150,000 | **block** |
| Texture dimension | > 2048² | warn |
| `isPlaceable` false | — | **block** |
| Dimensions missing | — | **block** publish |

Expected result on today's catalogue: **6 of 9 blocked.** That is correct behaviour — it
is the gate working, and it is why the gate is worth building.

Show the admin the AR-size preview before publish. The project's own
`ar-market-comparison.txt` §5 item 2 recommends exactly this.

---

## Layer 3 — API and database

| ID | Test |
| -- | ---- |
| IT-01 | `POST /api/admin/models` without `Authorization` → **401** |
| IT-02 | Wrong token, correct length → 401 (exercises `timingSafeEqual`) |
| IT-03 | Non-GLB bytes → 4xx, nothing written to `model_blob` |
| IT-04 | Re-upload identical bytes → deduplicated by SHA-256, no new blob |
| IT-05 | Upload a replacement → new `model_asset` version, old `is_current = false` |
| IT-06 | `GET /api/variants/:id/model` → `model/gltf-binary`, correct `Content-Length` |
| IT-07 | **Streamed GLB carries the baked `trueScale` transform** (after BUG-01 is fixed) |
| IT-08 | `db:seed:store` is idempotent — re-run changes nothing |
| IT-09 | Dimensions survive seed → API → `Variant.product.dimensionsMm` |

---

## Layer 4 — Browser

| ID | Test | Assertion |
| -- | ---- | --------- |
| BT-01 | `/store/nivaas` and a product page render | 200, product name in DOM |
| BT-02 | `<model-viewer>` reaches loaded | within 15 s |
| BT-03 | Desktop AR fallback | "AR unavailable" message shown |
| BT-04 | **`ar-scale="fixed"` present** | guards against a regression to `auto` |
| BT-05 | **Fetch the streamed GLB, parse it, assert its bbox matches the declared size** | **catches BUG-01 without a phone** |
| BT-06 | "Will it fit?" form | 200×90 → "12 cm too wide" |
| BT-07 | 360×640 viewport | no horizontal scroll, AR button reachable |

**BT-05 is the cheapest high-value test in this plan.** It catches the critical defect in
CI, in a headless browser, with no device.

---

## Layer 5 — Device tests

**Run `docs/ar-changes.txt` sections A–G as written.** They are specific and well
designed. This section adds what they lack.

### Fleet — minimum three Android phones

| Slot | Class | Why |
| ---- | ----- | --- |
| A | Recent flagship with Depth API | best case, establishes the ceiling |
| B | **Mid-range 2–3 years old** (Redmi Note / Realme / Moto G) | **the actual Indian market** |
| C | ARCore-listed, no Depth API, or stale Play Services for AR | the degraded path |
| D | Any iPhone | **BUG-01 — check this first** |

### Recording template

Incomplete rows are failures, not blanks.

```
Device   : ______________  Android: ____  Chrome: ____
Play Services for AR version : ____________
Room     : ________  Light: bright / normal / dim
Floor    : plain / patterned / rug / glossy tile
Network  : WiFi / 4G / 3G   Measured: ____ Mbps
Tape measure present : yes / no
Build/commit : ____________   Debug overlay : on / off
```

### Procedures beyond A–G

| ID | Test | Pass criterion |
| -- | ---- | -------------- |
| **DT-01** | Tape 2.00 m. Place the Mahal sofa along it. Measure. | Within **±3%** of 212 cm (206–218 cm). **Core claim — if this fails nothing else matters.** |
| DT-02 | Repeat DT-01 from 1 m, 2 m, 3 m | All within ±3%, and within 2% of each other |
| **DT-03** | Mark with tape, place, walk a 15 m loop, return | **< 5 cm** movement. Record the number. Tests the anchor path. |
| DT-04 | Ruler tool across the same 2.00 m tape | Record error. If it matches DT-01's error, the fault is phone tracking, not the model |
| DT-05 | Aim at a table, then a wall, with a floor product selected | Both refused with a hint; reticle amber |
| DT-06 | Cover the camera 5 s; whip-pan | "Tracking lost"; dragging stops; pieces return |
| **DT-07** | **iPhone: open each of the 9 products and tap AR** | **Expect failure for 6+.** Record exactly what Quick Look does with a 111 km model — refuse, blank, or clamp. **This is BUG-01's field evidence.** |
| DT-08 | 3G throttle, open the sofa, enter AR | Record seconds to first paint. Note whether an escape is offered |
| DT-09 | Place 8–10 pieces, use for 10 minutes | Record FPS, heat, whether the page reloads |
| DT-10 | Revoke camera permission, or disable Play Services for AR, tap AR | **Expect no AR path at all** — BUG-03's evidence |
| DT-11 | Halo floor lamp and Sabha dining table | Confirm the "approximate" notice shows, and record how wrong they look to a non-engineer |
| DT-12 | Glossy tile, dark rug, plain white floor | Record time-to-floor-lock for each |

### Regression set — run every release

**DT-01, DT-03, DT-05, DT-07, DT-10.** These five map to the critical and high defects.

---

## On-device diagnostics overlay (ready to apply)

Device testing without instrumentation produces impressions, not numbers. The project's
own market doc §5 item 3 asks for *"a hidden debug overlay (tracking state, floor height,
model size)"* — this is it, matched to `roomEngine`'s actual architecture.

Additive: one new file plus a small emit and a render line. Gate on `?debug`.

### New file — `src/features/experience/ArDebugPanel.tsx`

```tsx
import type { TrueScale } from "@/lib/trueScale";

export interface ArDebug {
  /** XRSession.enabledFeatures — what the runtime GRANTED, not what we asked for. */
  granted: string[];
  requested: string[];
  tracking: "ok" | "limited" | "lost";
  anchored: boolean;
  floorSet: boolean;
  /** Metres above the room floor plane that the reticle currently sits. */
  targetY: number | null;
  surface: string | null;
  items: number;
  fps: number;
  /** Selected piece. */
  name: string | null;
  scale: TrueScale | null;
  sizeM: { width: number; depth: number; height: number } | null;
  declaredMm: { width: number | null; depth: number | null; height: number | null } | null;
  modelBytes: number | null;
  modelLoadMs: number | null;
}

const cm = (m: number) => (m * 100).toFixed(1);

export default function ArDebugPanel({ d }: { d: ArDebug }) {
  const denied = d.requested.filter((f) => !d.granted.includes(f));
  const row = (k: string, v: React.ReactNode, bad = false) => (
    <div className="flex justify-between gap-3">
      <span className="opacity-60">{k}</span>
      <span className={bad ? "font-bold text-red-400" : ""}>{v}</span>
    </div>
  );
  return (
    <div className="pointer-events-auto absolute left-2 top-2 max-w-[74vw] rounded-lg bg-black/80 p-2.5 font-mono text-[10px] leading-relaxed text-white backdrop-blur">
      {row("fps", d.fps, d.fps < 20)}
      {row("tracking", d.tracking, d.tracking !== "ok")}
      {row("anchored", d.anchored ? "yes" : "NO", !d.anchored)}
      {row("floor", d.floorSet ? "set" : "not set", !d.floorSet)}
      {row("surface", d.surface ?? "—")}
      {row("target y", d.targetY === null ? "—" : `${cm(d.targetY)} cm`,
           d.targetY !== null && Math.abs(d.targetY) > 0.15)}
      {row("pieces", d.items)}
      {d.name && row("selected", d.name)}
      {d.scale && row("scale status", d.scale.status, d.scale.status !== "verified")}
      {d.scale && row("factor", d.scale.scale.toExponential(3))}
      {d.scale && row("deviation", `${(d.scale.deviation * 100).toFixed(1)}%`, d.scale.deviation > 0.05)}
      {d.scale?.swapWidthDepth && row("turned", "90 deg")}
      {d.sizeM && row("DRAWN", `${cm(d.sizeM.width)} x ${cm(d.sizeM.depth)} x ${cm(d.sizeM.height)} cm`)}
      {d.declaredMm && row("listed",
        `${(d.declaredMm.width ?? 0) / 10} x ${(d.declaredMm.depth ?? 0) / 10} x ${(d.declaredMm.height ?? 0) / 10} cm`)}
      {row("model", d.modelBytes === null ? "…" : `${(d.modelBytes / 1e6).toFixed(2)} MB / ${d.modelLoadMs} ms`)}
      {row("granted", d.granted.join(",") || "none")}
      {denied.length > 0 && row("DENIED", denied.join(","), true)}
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(JSON.stringify(d))}
        className="mt-1.5 w-full rounded bg-white/15 px-2 py-1"
      >
        copy readings
      </button>
    </div>
  );
}
```

### Wiring

`roomEngine` already has an emit/`dirty` mechanism and already tracks `tracking`,
`floorSet`, `anchor`, `target` and per-item `scale`. Extend its emitted state with the
fields above rather than adding a parallel system:

```diff
  // roomEngine.ts — in the state it already emits
+ debug: {
+   granted: Array.from((this.session as XRSession & { enabledFeatures?: string[] }).enabledFeatures ?? []),
+   requested: ["hit-test", "dom-overlay", "light-estimation", "anchors"],
+   tracking: this.tracking,
+   anchored: Boolean(this.anchor),
+   floorSet: this.floorSet,
+   targetY: this.target ? this.target.local.y : null,
+   surface: this.target?.surface ?? null,
+   items: this.items.length,
+   fps: this.fps,            // add a rolling counter in update()
+ },
```

```diff
  // ArScene.tsx — render it
+ {new URLSearchParams(location.search).has("debug") && <ArDebugPanel d={state.debug} />}
```

### The three readings that settle open questions immediately

- **`anchored: NO`** — the device did not grant anchors; expect drift in DT-03.
- **`DRAWN 40.6 x 40.0 x 82.0 cm` vs `listed 40 x 40 x 152 cm`** — makes BUG-02 visible
  to a non-engineer standing in the room.
- **`DENIED: anchors,light-estimation`** — distinguishes a platform limit from a code
  defect, which is otherwise impossible to tell apart on a phone.

> `navigator.clipboard` needs a secure context. AR already requires HTTPS, so
> `npm run dev:tunnel` satisfies it.

---

## Gates

**Do not run a retailer pilot until all of these hold.**

| Gate | Criterion |
| ---- | --------- |
| **G1** | DT-01 passes on all three Android phones — within ±3% of the tape |
| **G2** | DT-03 under 5 cm drift after a 15 m walk |
| **G3** | **BUG-01 fixed** — the streamed GLB carries the scale; DT-07 shows correct size on iPhone |
| **G4** | All pilot products resolve `verified` — no `approximate` in a customer-facing catalogue |
| **G5** | DT-10 passes — a failed WebXR session still offers Scene Viewer |
| **G6** | `Sofa.glb` under 5 MB; DT-08 first paint under 10 s on 4G |
| **G7** | Asset quality gate live in admin |
| **G8** | CC-BY 3.0 attribution displayed, or the assets replaced |
| **G9** | `ADMIN_TOKEN` is a long random value, not `12345` |

G1–G4 are the product. G5–G9 are the minimum not to embarrass the retailer.
