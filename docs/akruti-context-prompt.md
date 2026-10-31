# Context prompt — paste this at the start of a new Gemini chat

I'm building a product called **Akruti**: a 3D + AR commerce platform for furniture
retailers. A retailer uploads a GLB per product variant; shoppers view it in 3D on the
web, and on an ARCore phone they place it in their actual room and get a
FIT / TIGHT / DOESN'T FIT verdict against the real walls and furniture.

## Stack as it exists today

- React 18 + TypeScript + Vite 5, Tailwind 3.4 (`darkMode: 'class'`), React Router 6
- Express 4 API (`server/`), PostgreSQL 18 via `pg`
- `@google/model-viewer` 4.3 for the 3D viewer, `three` 0.183 + raw WebXR for the AR scene
- `qrcode` for desktop → phone handoff, `nodemailer` for demo-request emails

## Database (PostgreSQL)

```
category ──< product ──< product_variant ──< model_asset >── model_blob
```

- `product` — slug, name, description, status enum (draft/active/archived),
  and real-world size as `width_mm`, `height_mm`, `depth_mm` (numeric, nullable)
  plus `dimension_unit` ('mm' | 'cm' | 'in') for display only.
- `product_variant` — a SKU: `material`, `color_hex`, `is_default`, `sort_order`.
- `model_asset` — versioned GLB per variant; exactly one row `is_current` per variant.
  Carries `meta` jsonb (bounding box in metres read at ingest) and `tint` jsonb
  (which glTF material indices to recolour, plus the average texture colour) so
  colour variants of one product share a single GLB.
- `model_blob` — the GLB bytes, content-addressed by SHA-256, `STORAGE EXTERNAL`,
  with a CHECK constraint on the `glTF` magic bytes.
- `v_variant_current_model` — read view joining the above without the bytes.
- PKs are `uuidv7()`. Timestamps are `timestamptz`. 3D dimensions are metres.

## API (`/api`)

- `GET /variants` and `GET /variants/:id` — public catalogue shape
- `GET /models/:sha256` — GLB bytes, immutable cache (colours share the URL)
- `GET /variants/:id/model` — a variant's current GLB, ETag-revalidated
- `GET /variants/:id/share` and `/qr?format=png|svg` — the QR encodes
  `<base>/view/<variantId>`, never the model file, so replacing a model keeps the QR

## AR behaviour

`ProductArExperience` picks a path per device:

| Platform | Path | Result |
|---|---|---|
| Android Chrome (WebXR + ARCore) | in-page `ArScene` | room scan → real-size placement → fit verdict |
| iOS Safari | `<model-viewer>` → Quick Look | plain placement, no fit check |
| Desktop | 3D viewer only | "AR unavailable" + QR |

The WebXR path requests `hit-test` (required) and `plane-detection`,
`depth-sensing` (cpu-optimized, raw), `anchors`, `dom-overlay`, `light-estimation`
(optional). Depth pixels are unprojected to metric points and fused into a 5 cm
voxel hash (3 frames per voxel to stand in for the confidence image WebXR doesn't
expose). `fit.ts` then checks collisions against walls, scanned real furniture,
raised surfaces and other placed items, plus a user-chosen clearance of
0 / 5 / 30 / 60 cm.

Pure modules with no browser or three.js imports, so they unit-test in Node:
`src/lib/ar/room.ts`, `fit.ts`, `geometry.ts`.

## Routes

`/` · `/about` · `/experience` · `/3d-model` · `/request-demo` ·
`/request-demo/verify` · `/view/:variantId` (the QR destination, outside the
marketing layout) · `/admin` · `/admin/models/new`

## What I'm building next

A reusable **storefront template** — one out-of-the-box furniture shop I can re-skin
per client instead of designing a new site each time. For a new client I want to
change only: a brand-kit token block (neutral hue, accent, corner radius, two font
families), the catalogue rows, a strings file for hero/category copy, and the
route or subdomain it's served at. Every product page deep-links into the existing
`/view/:variantId` AR experience and carries a "3D & AR by Akruti" badge.

## How I want you to help

Answer against this stack specifically. Prefer changes that fit the schema above
rather than new tables, tell me when something needs a migration, and keep real
dimensions in millimetres in the DB and metres in the 3D code. Ask me before
assuming a library I haven't listed.
