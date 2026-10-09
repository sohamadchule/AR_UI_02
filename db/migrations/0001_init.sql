-- 0001_init: catalog + 3D model storage.
--
-- Design summary
--   category ──< product ──< product_variant ──< model_asset >── model_blob
--
--   * product          the sellable item shown on the site (stable slug).
--   * product_variant  a purchasable configuration (SKU): fabric, colour, finish.
--   * model_asset      a versioned GLB attached to a variant. Rows are immutable
--                      history; exactly one row per variant is `is_current`.
--   * model_blob       the GLB bytes, content-addressed by SHA-256. Kept in its
--                      own table so catalog queries never touch large values and
--                      identical files are stored once.
--
-- Conventions
--   * Primary keys are UUIDv7 (PostgreSQL 18 `uuidv7()`): globally unique and
--     time-ordered, so inserts stay index-friendly.
--   * Timestamps are `timestamptz` (UTC); `updated_at` is maintained by trigger.
--   * Units for any 3D dimensions are metres, matching the glTF/AR convention.
--   * Names are snake_case; constraints and indexes are explicitly named.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TYPE product_status AS ENUM ('draft', 'active', 'archived');

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

CREATE TABLE category (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  slug        text        NOT NULL,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT category_slug_key    UNIQUE (slug),
  CONSTRAINT category_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT category_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE product (
  id           uuid           PRIMARY KEY DEFAULT uuidv7(),
  category_id  uuid           NOT NULL REFERENCES category (id) ON DELETE RESTRICT,
  slug         text           NOT NULL,
  name         text           NOT NULL,
  description  text           NOT NULL DEFAULT '',
  status       product_status NOT NULL DEFAULT 'draft',
  created_at   timestamptz    NOT NULL DEFAULT now(),
  updated_at   timestamptz    NOT NULL DEFAULT now(),
  CONSTRAINT product_slug_key    UNIQUE (slug),
  CONSTRAINT product_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT product_name_not_blank CHECK (btrim(name) <> '')
);
CREATE INDEX product_category_id_idx ON product (category_id);
CREATE INDEX product_status_idx      ON product (status);
CREATE TRIGGER product_set_updated_at BEFORE UPDATE ON product
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE product_variant (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  product_id  uuid        NOT NULL REFERENCES product (id) ON DELETE CASCADE,
  sku         text        NOT NULL,
  name        text        NOT NULL,
  material    text,
  color_hex   text,
  is_default  boolean     NOT NULL DEFAULT false,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variant_sku_key        UNIQUE (sku),
  CONSTRAINT product_variant_name_per_product UNIQUE (product_id, name),
  CONSTRAINT product_variant_sku_format     CHECK (sku ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  CONSTRAINT product_variant_color_format   CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$')
);
CREATE INDEX product_variant_product_id_idx ON product_variant (product_id, sort_order);
-- At most one default variant per product.
CREATE UNIQUE INDEX product_variant_one_default_idx ON product_variant (product_id) WHERE is_default;
CREATE TRIGGER product_variant_set_updated_at BEFORE UPDATE ON product_variant
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 3D model storage
-- ---------------------------------------------------------------------------

-- Content-addressed GLB bytes. Immutable: rows are inserted, never updated.
CREATE TABLE model_blob (
  sha256      char(64)    PRIMARY KEY,
  content     bytea       NOT NULL,
  size_bytes  bigint      NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_blob_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT model_blob_size_matches  CHECK (size_bytes = octet_length(content)),
  -- Binary glTF files start with the ASCII magic "glTF".
  CONSTRAINT model_blob_is_glb        CHECK (substring(content FROM 1 FOR 4) = '\x676c5446'::bytea)
);
-- GLBs are already compressed; skip pglz and keep the value out of line.
ALTER TABLE model_blob ALTER COLUMN content SET STORAGE EXTERNAL;

CREATE TABLE model_asset (
  id                uuid        PRIMARY KEY DEFAULT uuidv7(),
  variant_id        uuid        NOT NULL REFERENCES product_variant (id) ON DELETE CASCADE,
  -- A blob can be shared by assets; it can only be removed once unreferenced.
  blob_sha256       char(64)    NOT NULL REFERENCES model_blob (sha256) ON DELETE RESTRICT,
  version           integer     NOT NULL,
  is_current        boolean     NOT NULL DEFAULT false,
  original_filename text        NOT NULL,
  content_type      text        NOT NULL DEFAULT 'model/gltf-binary',
  -- Facts read from the GLB at ingest: generator, mesh/material/texture counts,
  -- bounding box in metres, etc. Informational; never used for access control.
  meta              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_asset_version_per_variant UNIQUE (variant_id, version),
  CONSTRAINT model_asset_version_positive    CHECK (version > 0),
  CONSTRAINT model_asset_content_type        CHECK (content_type = 'model/gltf-binary'),
  CONSTRAINT model_asset_meta_is_object      CHECK (jsonb_typeof(meta) = 'object')
);
CREATE INDEX model_asset_blob_sha256_idx ON model_asset (blob_sha256);
-- Exactly one current model per variant (zero allowed until the first upload).
CREATE UNIQUE INDEX model_asset_one_current_idx ON model_asset (variant_id) WHERE is_current;

-- ---------------------------------------------------------------------------
-- Read model for the application: current model per variant, without the bytes.
-- ---------------------------------------------------------------------------

CREATE VIEW v_variant_current_model AS
SELECT
  p.id           AS product_id,
  p.slug         AS product_slug,
  p.name         AS product_name,
  p.status       AS product_status,
  c.slug         AS category_slug,
  v.id           AS variant_id,
  v.sku,
  v.name         AS variant_name,
  v.material,
  v.color_hex,
  v.is_default,
  a.id           AS asset_id,
  a.version      AS model_version,
  a.original_filename,
  a.meta,
  b.sha256       AS model_sha256,
  b.size_bytes   AS model_size_bytes,
  a.uploaded_at  AS model_uploaded_at
FROM product_variant v
JOIN product  p ON p.id = v.product_id
JOIN category c ON c.id = p.category_id
LEFT JOIN model_asset a ON a.variant_id = v.id AND a.is_current
LEFT JOIN model_blob  b ON b.sha256 = a.blob_sha256;
