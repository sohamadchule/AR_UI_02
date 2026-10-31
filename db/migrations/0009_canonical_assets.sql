-- Canonical asset pipeline.
--
-- A product's listed size is the source of truth. Models arrive in any unit and
-- sometimes side-on, so each one is rewritten once, at ingest, to stand at that
-- size (see toRealSize in db/scripts/glb.mjs). The rewritten bytes are stored as
-- a NEW model_blob and a NEW model_asset version: the original upload is never
-- modified, and a blob shared by several products is never normalised in place —
-- each product gets its own derived blob, content-addressed like any other.
--
-- This migration records two things that were previously implicit:
--   1. how a model was normalised, and by which pipeline version;
--   2. where a product's listed dimensions actually came from.

-- --------------------------------------------------------------------------
-- 1. How the model was normalised.
-- --------------------------------------------------------------------------
-- Null for assets stored before this pipeline existed, and for any asset whose
-- bytes are the raw upload. Shape:
--   {
--     "pipelineVersion": 2,
--     "status":    "verified" | "approximate" | "no-dimensions",
--     "factor":    2.1115,        -- the single uniform factor applied
--     "turned":    false,         -- quarter turn for a side-on model
--     "deviation": 0.038,         -- worst side's disagreement with the listing
--     "sourceSha256": "…",        -- the blob this was derived from
--     "targetMm":  { "width": 2120, "depth": 880,  "height": 760 },
--     "drawnMm":   { "width": 2120, "depth": 915,  "height": 752 }
--   }
ALTER TABLE model_asset
  ADD COLUMN IF NOT EXISTS normalization jsonb;

ALTER TABLE model_asset
  DROP CONSTRAINT IF EXISTS model_asset_normalization_is_object;
ALTER TABLE model_asset
  ADD CONSTRAINT model_asset_normalization_is_object
  CHECK (normalization IS NULL OR jsonb_typeof(normalization) = 'object');

-- Find assets produced by an older pipeline, so they can be re-derived.
CREATE INDEX IF NOT EXISTS model_asset_pipeline_idx
  ON model_asset (((normalization ->> 'pipelineVersion')::int))
  WHERE normalization IS NOT NULL;

-- --------------------------------------------------------------------------
-- 2. Where the listed dimensions came from.
-- --------------------------------------------------------------------------
-- A model can agree perfectly with a number that was guessed. Agreement between
-- model and listing is recorded above; this records how much the listing itself
-- is worth. Only MEASURED_PHYSICAL or MANUFACTURER_SPEC may support a "real
-- size" claim to a customer.
ALTER TABLE product
  ADD COLUMN IF NOT EXISTS dimension_source text NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE product
  DROP CONSTRAINT IF EXISTS product_dimension_source_known;
ALTER TABLE product
  ADD CONSTRAINT product_dimension_source_known
  CHECK (dimension_source IN ('MEASURED_PHYSICAL', 'MANUFACTURER_SPEC', 'ESTIMATED', 'UNKNOWN'));

COMMENT ON COLUMN product.dimension_source IS
  'Provenance of width_mm/depth_mm/height_mm. MEASURED_PHYSICAL: a tape on the real product. '
  'MANUFACTURER_SPEC: from the maker''s specification. ESTIMATED: inferred, including from the '
  'model itself. UNKNOWN: not recorded.';

-- The seeded store catalogue carries a designed specification, not a measurement.
UPDATE product
   SET dimension_source = 'MANUFACTURER_SPEC'
 WHERE dimension_source = 'UNKNOWN'
   AND width_mm IS NOT NULL
   AND depth_mm IS NOT NULL
   AND height_mm IS NOT NULL;
