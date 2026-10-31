// Loads the starter catalog and stores the GLB files in the database.
// Idempotent: re-running changes nothing unless a model file's content changed,
// in which case a new model_asset version is recorded and made current.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DB_DIR, connect } from './lib.mjs';
import { glbMeta, toRealSize } from './glb.mjs';
import { analyzeMaterials, buildTint } from './tint.mjs';

const MODELS = join(DB_DIR, 'seed', 'models');

const CATEGORIES = [
  { slug: 'seating', name: 'Seating' },
  { slug: 'lighting', name: 'Lighting' },
];

const PRODUCTS = [
  {
    slug: 'upholstered-dining-chair',
    category: 'seating',
    name: 'Upholstered Dining Chair',
    description: 'High-back dining chair with a solid wood frame and upholstered seat.',
    // Real-world size in mm, [width, depth, height]: the model's own (it is authored in metres).
    size: [826.6, 570.3, 686.2],
    // `tint: true` recolours the model's fabric materials; `hex` defaults to the detected colour.
    variants: [
      { sku: 'CHAIR-STD', name: 'Standard', material: 'Velvet', isDefault: true, file: 'chair.glb', tint: true },
      { sku: 'CHAIR-OCEAN', name: 'Ocean Blue', material: 'Velvet', isDefault: false, file: 'chair.glb', tint: true, hex: '#2F5D8A' },
      { sku: 'CHAIR-SAGE', name: 'Sage Green', material: 'Velvet', isDefault: false, file: 'chair.glb', tint: true, hex: '#7D9A78' },
      { sku: 'CHAIR-DMK', name: 'Damask', material: 'Damask fabric', isDefault: false, file: 'chair-damask.glb' },
    ],
  },
  {
    slug: 'table-lamp',
    category: 'lighting',
    name: 'Table Lamp',
    description: 'Compact table lamp.',
    size: [287.5, 287, 569.8],
    variants: [{ sku: 'LAMP-STD', name: 'Standard', material: null, isDefault: true, file: 'lamp.glb' }],
  },
];

const db = connect();
await db.connect();
try {
  await db.query('BEGIN');

  const categoryId = new Map();
  for (const c of CATEGORIES) {
    const { rows } = await db.query(
      `INSERT INTO category (slug, name) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [c.slug, c.name],
    );
    categoryId.set(c.slug, rows[0].id);
  }

  for (const p of PRODUCTS) {
    const [width, depth, height] = p.size;
    const { rows: [product] } = await db.query(
      `INSERT INTO product (category_id, slug, name, description, status, width_mm, depth_mm, height_mm, dimension_unit)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, 'cm')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
         width_mm = EXCLUDED.width_mm, depth_mm = EXCLUDED.depth_mm, height_mm = EXCLUDED.height_mm,
         dimension_unit = EXCLUDED.dimension_unit
       RETURNING id`,
      [categoryId.get(p.category), p.slug, p.name, p.description, width, depth, height],
    );

    let order = 0;
    for (const v of p.variants) {
      // Stored at the product's real size: centred, base on the floor.
      const bytes = toRealSize(readFileSync(join(MODELS, v.file)), { width, depth, height }).bytes;
      const meta = glbMeta(bytes); // also validates the container
      const sha = createHash('sha256').update(bytes).digest('hex');
      let tint = null;
      if (v.tint) {
        const materials = analyzeMaterials(bytes);
        tint = buildTint(materials, materials.filter((m) => m.suggested).map((m) => m.index));
      }

      const { rows: [variant] } = await db.query(
        `INSERT INTO product_variant (product_id, sku, name, material, color_hex, is_default, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, material = EXCLUDED.material, color_hex = EXCLUDED.color_hex,
           is_default = EXCLUDED.is_default, sort_order = EXCLUDED.sort_order
         RETURNING id`,
        [product.id, v.sku, v.name, v.material, tint ? (v.hex ?? tint.baseHex) : null, v.isDefault, order++],
      );

      await db.query(
        `INSERT INTO model_blob (sha256, content, size_bytes) VALUES ($1, $2, $3)
         ON CONFLICT (sha256) DO NOTHING`,
        [sha, bytes, bytes.length],
      );

      const { rows: [current] } = await db.query(
        'SELECT blob_sha256, version FROM model_asset WHERE variant_id = $1 AND is_current',
        [variant.id],
      );
      if (current?.blob_sha256 === sha) {
        await db.query('UPDATE model_asset SET tint = $2 WHERE variant_id = $1 AND is_current', [variant.id, tint && JSON.stringify(tint)]);
        console.log(`unchanged  ${v.sku.padEnd(11)} ${v.file}`);
        continue;
      }
      const { rows: [{ next }] } = await db.query(
        'SELECT COALESCE(MAX(version), 0) + 1 AS next FROM model_asset WHERE variant_id = $1',
        [variant.id],
      );
      await db.query('UPDATE model_asset SET is_current = false WHERE variant_id = $1 AND is_current', [variant.id]);
      await db.query(
        `INSERT INTO model_asset (variant_id, blob_sha256, version, is_current, original_filename, meta, tint)
         VALUES ($1, $2, $3, true, $4, $5, $6)`,
        [variant.id, sha, next, v.file, JSON.stringify(meta), tint && JSON.stringify(tint)],
      );
      console.log(`stored     ${v.sku.padEnd(11)} ${v.file}  v${next}  ${(bytes.length / 1024).toFixed(0)} KB`);
    }
  }

  await db.query('COMMIT');
} catch (err) {
  await db.query('ROLLBACK');
  throw err;
} finally {
  await db.end();
}
