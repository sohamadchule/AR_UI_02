-- 0005_product_colours: recolourable models and product dimensions.
--
-- Colour variants of one product share a single GLB: each variant still has its
-- own model_asset row, but they all point at the same content-addressed blob, so
-- the bytes are stored (and downloaded by the browser) once. The viewer recolours
-- the materials listed in model_asset.tint to the variant's color_hex.

-- Real-world size entered by the uploader. Stored in millimetres; `dimension_unit`
-- is only the unit the product is displayed in. All optional: when absent, the
-- app falls back to the bounding box read from the GLB.
ALTER TABLE product
  ADD COLUMN width_mm       numeric(10, 1),
  ADD COLUMN height_mm      numeric(10, 1),
  ADD COLUMN depth_mm       numeric(10, 1),
  ADD COLUMN dimension_unit text NOT NULL DEFAULT 'mm',
  ADD CONSTRAINT product_dimension_unit CHECK (dimension_unit IN ('mm', 'cm', 'in')),
  ADD CONSTRAINT product_dimensions_positive CHECK (
    (width_mm IS NULL OR width_mm > 0) AND (height_mm IS NULL OR height_mm > 0) AND (depth_mm IS NULL OR depth_mm > 0)
  );

-- Which materials recolour, plus facts the viewer needs to do it:
--   { "baseHex": "#E23100",
--     "materials": [{ "index": 0, "name": "fabric", "texAvg": [0.86, 0.86, 0.86] }] }
-- `index` is the glTF material index; `texAvg` the average linear colour of its
-- base colour texture. NULL means the model is shown exactly as authored.
ALTER TABLE model_asset
  ADD COLUMN tint jsonb,
  ADD CONSTRAINT model_asset_tint_shape CHECK (
    tint IS NULL OR (jsonb_typeof(tint -> 'materials') = 'array' AND jsonb_array_length(tint -> 'materials') > 0)
  );

-- Colour names must not repeat within a product either (case-insensitive).
CREATE UNIQUE INDEX product_variant_name_ci_idx ON product_variant (product_id, lower(name));
