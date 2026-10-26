-- 0006_store_pricing: what a storefront needs on top of the 3D catalogue.
--
-- Prices are whole rupees (integer paise would be over-precise for furniture and
-- the catalogue is India-only today). `mrp_inr` is the struck-through list price;
-- it is optional and must never sit below the selling price. `blurb` is the one
-- line shown under a product name on a catalogue card — the description column
-- is prose for the product page and is too long for a tile.

ALTER TABLE product
  ADD COLUMN price_inr integer,
  ADD COLUMN mrp_inr   integer,
  ADD COLUMN blurb     text NOT NULL DEFAULT '',
  ADD CONSTRAINT product_price_positive CHECK (price_inr IS NULL OR price_inr > 0),
  ADD CONSTRAINT product_mrp_positive   CHECK (mrp_inr IS NULL OR mrp_inr > 0),
  ADD CONSTRAINT product_mrp_gte_price  CHECK (mrp_inr IS NULL OR price_inr IS NULL OR mrp_inr >= price_inr);

-- The read view is rebuilt so storefront queries see the new columns.
DROP VIEW IF EXISTS v_variant_current_model;
CREATE VIEW v_variant_current_model AS
SELECT
  p.id           AS product_id,
  p.slug         AS product_slug,
  p.name         AS product_name,
  p.status       AS product_status,
  p.price_inr,
  p.mrp_inr,
  p.blurb,
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
