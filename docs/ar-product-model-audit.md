# Akruti — Product & 3D Model Audit (AR_UI_02)

**Audit date:** 2026-10-27
**Method:** every catalogue GLB parsed directly from its binary chunks; world-space
bounding boxes computed from accessor `POSITION.min`/`max` propagated through the full
node hierarchy (TRS and `matrix` both handled). The project's own `resolveTrueScale`
algorithm was then **ported exactly and run** against each model and its declared
dimensions, so the "RENDERED" column below is what AR will actually draw.
**Declared dimensions** are taken from `db/scripts/seed-store.mjs`, which is the seeded
source of truth for `product.width_mm / depth_mm / height_mm`.

---

## 1. Headline table — what AR actually draws

Declared and rendered are `width × depth × height` in cm.

| Product | Model file | Declared | **Rendered** | Status | Factor | Swap | Worst-axis error |
| ------- | ---------- | -------- | ------------ | ------ | ------ | ---- | ---------------- |
| Mahal 3-seater sofa | `Sofa.glb` | 212 × 88 × 76 | **212.0 × 91.5 × 75.2** | ✅ verified | ×2.1115 | — | 3.8% |
| Ira lounge chair | `Chair.glb` | 78 × 82 × 94 | **78.0 × 81.5 × 96.5** | ✅ verified | ×0.0000070 | — | 2.6% |
| Grid bookshelf | `Bookshelf.glb` | 180 × 32 × 185 | **180.0 × 32.7 × 180.0** | ✅ verified | ×0.0180 | **yes** | 2.8% |
| Perch bar stool | `Stool.glb` | 36 × 36 × 74 | 36.0 × 35.9 × **86.2** | ⚠ approximate | ×1.0334 | — | 14.1% |
| Kaam writing desk | `Desk.glb` | 140 × 65 × 75 | 140.0 × **81.5** × 70.9 | ⚠ approximate | ×0.0000020 | — | 20.3% |
| Nook side table | `SideTable.glb` | 55 × 55 × 48 | **67.4** × 55.0 × **34.6** | ⚠ approximate | ×0.0000010 | — | 38.8% |
| Alcove wardrobe | `Wardrobe.glb` | 120 × 58 × 190 | **201.9** × 46.6 × 190.0 | ⚠ approximate | ×0.5544 | — | 40.6% |
| Sabha dining table | `DiningTable.glb` | 122 × 122 × 75 | 122.0 × 122.2 × **49.0** | ⚠ approximate | ×0.0000256 | — | 53.0% |
| Halo floor lamp | `Lamp.glb` | 40 × 40 × 152 | 40.6 × 40.0 × **82.0** | ⚠ approximate | ×0.0000091 | — | **85.4%** |

**3 verified, 6 approximate.** This matches `db/seed/furniture/SOURCE.txt` exactly — the
project's own assessment is accurate and honest.

### What "approximate" costs in practice

The algorithm preserves the model's *shape* and takes the median axis ratio, so a
mismatched model lands close on some axes and badly wrong on others. The failures are not
cosmetic:

- **Halo floor lamp: a 152 cm floor lamp is drawn 82 cm tall.** Barely half height — it
  will read as a table lamp standing on the floor.
- **Sabha dining table: a 75 cm dining table is drawn 49 cm high.** That is coffee-table
  height. A customer checking whether chairs fit under it gets a wrong answer.
- **Alcove wardrobe: a 120 cm wardrobe is drawn 202 cm wide** — 68% too wide, and it will
  trigger false overlap and wall warnings against everything near it.
- **Nook side table is 23% too wide and 28% too short.**

The engine labels all of these and the project is right not to fake them. But a
"real size" product in which **two-thirds of the catalogue is visibly the wrong size** is
not yet demonstrable to a retailer. This is the gap the project's own
`ar-market-comparison.txt` §4.1 identifies as the biggest one, and this table is the
quantified version of it.

---

## 2. Provenance and licensing

`db/seed/furniture/SOURCE.txt` is explicit and should be taken seriously:

> *Low-poly furniture models from the Google Poly archive … Licence: CC-BY 3.0 …
> "<model title>" by Poly by Google — **attribution required if these ship publicly**.*

| File | Origin | Licence |
| ---- | ------ | ------- |
| `Chair.glb`, `DiningTable.glb`, `SideTable.glb`, `Desk.glb`, `Bookshelf.glb`, `Wardrobe.glb`, `Stool.glb`, `Lamp.glb` | Google Poly archive | **CC-BY 3.0 — attribution required** |
| `Sofa.glb` | FurniMesh | Commercial use, no attribution required |

**Action required before any public demo or pilot:** either display CC-BY 3.0
attribution wherever these are served, or replace them. Replacing is the better answer
because it also fixes §1.

Also present but unused by the store catalogue: `db/seed/models/` still holds
`chair-damask.glb` (**embedded copyright: `(c) 2021 Wayfair, CC BY 4.0 International,
asset created by Eric Chadwick`**), `chair.glb` (Khronos SheenChair sample) and
`lamp.glb`. These are seeds for the older `seed.mjs` path. If that path is still live,
the same attribution obligation applies — and a *competitor's* asset in a retailer-facing
demo is worth avoiding on presentation grounds alone.

---

## 3. Asset weight

| Model | Bytes | Triangles | Textures |
| ----- | ----- | --------- | -------- |
| **`Sofa.glb`** | **12.85 MB** | **282,111** | 2 (3.91 MB) |
| `Stool.glb` | 0.13 MB | 740 | 1 (0.10 MB) |
| `DiningTable.glb` | 0.09 MB | 3,180 | 0 |
| `Chair.glb` | 0.06 MB | 880 | 0 |
| `Desk.glb` | 0.05 MB | 624 | 0 |
| `Lamp.glb` | 0.04 MB | 928 | 0 |
| `SideTable.glb` | 0.03 MB | 320 | 0 |
| `Wardrobe.glb` | 0.03 MB | 366 | 0 |
| `Bookshelf.glb` | 0.02 MB | 800 | 1 |

The sofa is **100× the file size and 90× the triangle count of the median model.** The
project already knows (`PROJECT_GUIDE.md` §5, `ar-changes.txt`), so this is confirmation
rather than news — but note the compounding: the sofa has **three colourways sharing one
GLB**, and `roomEngine` caches by URL and clones, so placing three sofas is ~846,000
triangles from a single 12.85 MB download.

Transfer time for `Sofa.glb` alone, excluding TLS/latency/parse:

| Link | Time |
| ---- | ---- |
| 8 Mbps 4G | ~12.9 s |
| 1.5 Mbps 3G | ~68 s |

This happens *after* the AR session has started, with the customer holding the phone up
at an empty camera feed. Compression is not a nice-to-have.

**Highest-return fixes, in order:** KTX2/BasisU the two 2048² textures (3.91 MB → roughly
0.7–1.2 MB, and far less GPU memory); Draco or `meshopt` the geometry; decimate 282k
triangles toward the ~20–40k a sofa needs at AR viewing distance. Target <5 MB, which is
the project's own stated goal and matches the Shopify budget its market doc cites.

---

## 4. Model hygiene — checks run

| Check | Result |
| ----- | ------ |
| Valid glTF 2.0 binary, correct magic, parseable chunks | **All 10 pass** |
| Node matrix scales | No baked non-uniform scaling found |
| Double-application of transforms | **None.** `trueScale` is applied once in `makeProduct`; grounding uses the already-transformed box |
| Base resting on origin | Raw models vary widely (`Chair.glb` sits +2.76 m above origin, `Lamp.glb` +3.62 m, `Sofa.glb` −0.38 m) — **handled correctly** by `model.position.set(-centre.x, -fitted.min.y, -centre.z)`. Not a defect. |
| Unit errors | 5 of 9 authored in absurd units (10⁻⁶ scale) — **all rescued** by `trueScale` |
| Side-on authoring | `Bookshelf.glb` detected and turned 90° — correct |
| Category / placement match | `placementOf()` is a **regex over the product name**. "Halo floor lamp" matches no wall/tabletop rule → `floor` ✓. But `/\b(table lamps?\|...)\b/` would catch a product named "Halo table lamp" — brittle by design. The project's own docs flag this; a DB column is the fix. |
| Generic demo models presented as products | **9 of 9.** All catalogue models are Poly/FurniMesh demo assets, not photographs of real products. Disclosed in `SOURCE.txt`, not disclosed in the UI. |

---

## 5. Recommendations

In priority order. None requires touching the AR engine.

1. **Fix the iOS/Scene Viewer size bypass first** (see `ar-architecture-audit.md` §2.1).
   Bake the `trueScale` factor into the GLB when it is streamed. This is the only item
   here that is currently making the product *wrong* rather than *approximate*, and it
   affects every iPhone visitor.
2. **Replace the 6 approximate models.** The engine cannot fix a model whose shape is not
   the product. Re-model or re-source `Lamp`, `DiningTable`, `Wardrobe`, `SideTable`,
   `Desk`, `Stool`. Doing this is also the first real test of Akruti's asset pipeline —
   the capability the business case depends on and that has never been exercised.
3. **Compress `Sofa.glb` to under 5 MB.**
4. **Add a quality gate at upload.** Refuse >5% shape deviation, >~5 MB, >~150k triangles,
   or implausible dimensions; show the admin the AR-size preview before publishing. The
   project's own market doc recommends exactly this. `MAX_GLB_MB` is currently **50**.
5. **Resolve CC-BY 3.0 attribution** — display it or replace the assets.
6. **Add `placement_surface` as a product column**, defaulting from the current regex, so
   placement stops depending on product naming.
7. **Label demo content in the UI** until a real retailer's products are in there.

---

## 6. One thing worth saying plainly

The scaling engine is doing something genuinely impressive: it takes a chair authored
**111 kilometres wide** and draws it at 78 cm, correctly. Five of nine models are only
usable at all because of it.

That is also the warning. The engine is currently compensating for a catalogue that is
entirely demo assets, and it is doing so well enough that the underlying content problem
is easy to overlook. **The models are the product.** Until a retailer's real furniture is
in there at verified dimensions, every number in this document describes the quality of
the compensation, not the quality of the product.
