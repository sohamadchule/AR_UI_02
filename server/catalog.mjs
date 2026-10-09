import { pool } from './db.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value) => UUID.test(value);

// Active products only; a variant is listed once it has a current model.
const SELECT_VARIANTS = `
  SELECT v.id, v.sku, v.name, v.material, v.is_default,
         p.slug AS product_slug, p.name AS product_name, p.description,
         c.slug AS category_slug, c.name AS category_name,
         b.sha256, b.size_bytes, a.meta, a.version
    FROM product_variant v
    JOIN product p        ON p.id = v.product_id AND p.status = 'active'
    JOIN category c       ON c.id = p.category_id
    JOIN model_asset a    ON a.variant_id = v.id AND a.is_current
    JOIN model_blob b     ON b.sha256 = a.blob_sha256`;

/** Shape sent to the browser: no internal storage details beyond a cache-busting hash. */
function toPublic(row) {
  const size = row.meta?.bbox_m?.size ?? null;
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    material: row.material,
    isDefault: row.is_default,
    product: { slug: row.product_slug, name: row.product_name, description: row.description },
    category: { slug: row.category_slug, name: row.category_name },
    model: {
      url: `/api/variants/${row.id}/model?v=${row.sha256.slice(0, 12)}`,
      sizeBytes: row.size_bytes,
      version: row.version,
      dimensionsM: size ? { width: size[0], height: size[1], depth: size[2] } : null,
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
