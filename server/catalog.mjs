import { pool } from './db.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => UUID.test(value);

// Active products only; a variant is listed once it has a current model.
const SELECT_VARIANTS = `
  SELECT v.id, v.sku, v.name, v.material, v.color_hex, v.is_default,
         p.id AS product_id, p.slug AS product_slug, p.name AS product_name, p.description,
         p.width_mm, p.height_mm, p.depth_mm, p.dimension_unit,
         p.price_inr, p.mrp_inr, p.blurb,
         c.slug AS category_slug, c.name AS category_name,
         b.sha256, b.size_bytes, a.meta, a.version, a.tint
    FROM product_variant v
    JOIN product p        ON p.id = v.product_id AND p.status = 'active'
    JOIN category c       ON c.id = p.category_id
    JOIN model_asset a    ON a.variant_id = v.id AND a.is_current
    JOIN model_blob b     ON b.sha256 = a.blob_sha256`;

const mm = (v) => (v === null ? null : Number(v));

/** Shape sent to the browser: no internal storage details beyond a cache-busting hash. */
function toPublic(row) {
  const size = row.meta?.bbox_m?.size ?? null;
  const dims = [row.width_mm, row.height_mm, row.depth_mm].some((v) => v !== null)
    ? { width: mm(row.width_mm), height: mm(row.height_mm), depth: mm(row.depth_mm) }
    : null;
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    material: row.material,
    colorHex: row.color_hex,
    isDefault: row.is_default,
    product: {
      id: row.product_id,
      slug: row.product_slug,
      name: row.product_name,
      description: row.description,
      blurb: row.blurb,
      // Whole rupees; null when the catalogue has no price for this product yet.
      priceInr: row.price_inr === null ? null : Number(row.price_inr),
      mrpInr: row.mrp_inr === null ? null : Number(row.mrp_inr),
      dimensionsMm: dims,
      dimensionUnit: row.dimension_unit,
    },
    category: { slug: row.category_slug, name: row.category_name },
    model: {
      // Content-addressed: colours sharing a GLB share this URL, so switching colour never re-downloads.
      url: `/api/models/${row.sha256}`,
      sizeBytes: row.size_bytes,
      version: row.version,
      dimensionsM: size ? { width: size[0], height: size[1], depth: size[2] } : null,
      tint: row.tint ? { materials: row.tint.materials.map(({ index, texAvg, base, sheen }) => ({ index, texAvg, base, sheen })) } : null,
    },
  };
}

export async function listVariants() {
  const { rows } = await pool.query(`${SELECT_VARIANTS} ORDER BY c.name, p.name, v.sort_order`);
  return rows.map(toPublic);
}

export async function getVariant(id) {
  if (!isUuid(id)) return null;
  const { rows } = await pool.query(`${SELECT_VARIANTS} WHERE v.id = $1`, [id]);
  return rows[0] ? toPublic(rows[0]) : null;
}

/** GLB bytes by hash, only while some active product's current model uses them. */
export async function getModelBlob(sha256) {
  if (!/^[0-9a-f]{64}$/.test(sha256)) return null;
  const { rows } = await pool.query(
    `SELECT b.content, b.sha256, b.size_bytes
       FROM model_blob b
      WHERE b.sha256 = $1
        AND EXISTS (SELECT 1 FROM model_asset a
                      JOIN product_variant v ON v.id = a.variant_id
                      JOIN product p         ON p.id = v.product_id AND p.status = 'active'
                     WHERE a.blob_sha256 = b.sha256 AND a.is_current)`,
    [sha256],
  );
  return rows[0] ?? null;
}

/** The current GLB bytes for a variant, or null. */
export async function getModelFile(id) {
  if (!isUuid(id)) return null;
  const { rows } = await pool.query(
    `SELECT b.content, b.sha256, b.size_bytes, a.content_type
       FROM product_variant v
       JOIN product p     ON p.id = v.product_id AND p.status = 'active'
       JOIN model_asset a ON a.variant_id = v.id AND a.is_current
       JOIN model_blob b  ON b.sha256 = a.blob_sha256
      WHERE v.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
