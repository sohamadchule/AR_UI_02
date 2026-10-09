# Database

PostgreSQL 18 database `akruti`, separate from the older `ar` database.

## Commands

```sh
npm run db:setup     # create database, apply migrations, load seed data
npm run db:create    # create the database if missing
npm run db:migrate   # apply new migrations in db/migrations
npm run db:seed      # (re)load starter catalog + GLB files; idempotent
npm run db:verify    # byte-exact storage check + constraint tests
```

Connection string comes from `DATABASE_URL` in `.env` (see `.env.example`).

## Schema

```
category ──< product ──< product_variant ──< model_asset >── model_blob
                                                (versions)     (GLB bytes)
```

| Table             | Purpose |
| ----------------- | ------- |
| `category`        | Product grouping (Seating, Lighting). |
| `product`         | Sellable item; stable `slug`; `status` draft / active / archived. |
| `product_variant` | A SKU: fabric, colour, finish. One default variant per product. |
| `model_asset`     | A versioned GLB attached to a variant. Immutable history; exactly one `is_current` row per variant. Holds `meta` (counts, generator, bounding box in metres) read from the file. |
| `model_blob`      | The GLB bytes, keyed by SHA-256. Separate table so catalog queries never load large values, and identical files are stored once. |

`v_variant_current_model` joins everything the app needs for a variant (product,
SKU, current model version, size, metadata) **without** the bytes.

## Design decisions

- **UUIDv7 keys** (`uuidv7()`, new in PG 18): unique and time-ordered.
- **Replacing a model** inserts a new `model_asset` version and flips
  `is_current`; old versions stay for audit and rollback. A product's public URL
  never depends on the file.
- **Integrity in the database, not just the app:** `model_blob` rejects non-GLB
  bytes (magic check), a wrong `size_bytes`, and a malformed hash; partial unique
  indexes enforce one current model and one default variant; slugs and SKUs are
  format-checked; blobs cannot be deleted while referenced.
- **`content` uses `STORAGE EXTERNAL`**: GLBs are already compressed, so skip
  pointless compression and keep the data out of line.
- **Units are metres** (glTF/AR convention).
- **Migrations are plain SQL** with checksums; editing an applied file is an
  error. Add `0002_*.sql` for changes.

## Seed data

`db/seed/models/` holds the three GLB files copied from the AR project:

| SKU         | Product                  | File               |
| ----------- | ------------------------ | ------------------ |
| `CHAIR-STD` | Upholstered Dining Chair | `chair.glb`        |
| `CHAIR-DMK` | Upholstered Dining Chair | `chair-damask.glb` |
| `LAMP-STD`  | Table Lamp               | `lamp.glb`         |

## Notes

- Orphaned blobs (no `model_asset` references them) are not removed automatically;
  clean up with `DELETE FROM model_blob WHERE sha256 NOT IN (SELECT blob_sha256 FROM model_asset)`.

## API (server/)

`npm run dev:all` starts the API (port 3001) and Vite (5173, proxies `/api`).
`npm start` builds the site and serves it plus the API from one port.

| Route | Purpose |
| ----- | ------- |
| `GET /api/variants` | Every viewable model (active products with a current model). |
| `GET /api/variants/:id` | One variant. |
| `GET /api/variants/:id/model` | The GLB, streamed from `model_blob`; `ETag` = SHA-256, immutable cache (URL carries `?v=<hash>`). |
| `GET /api/variants/:id/qr?format=png\|svg&download=1` | QR for `<base>/view/<id>`. |

The QR target uses `PUBLIC_BASE_URL` if set, otherwise the host the request came in on.
For a phone, open the site by your computer's LAN address (not `localhost`), or set
`PUBLIC_BASE_URL`. Device AR needs HTTPS (e.g. a tunnel).
