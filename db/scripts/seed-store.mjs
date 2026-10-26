// Loads the storefront catalogue: nine furniture pieces with real sizes, prices
// and GLB models, for /store/<brand>.
//
// Idempotent, exactly like db/scripts/seed.mjs: re-running changes nothing
// unless a GLB's bytes changed, in which case a new model_asset version is
// recorded and made current.
//
//   npm run db:seed:store
//
// Models live in db/seed/furniture. They are low-poly CC-BY assets from the
// Google Poly archive — fine for a demo, replace them with the client's own.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DB_DIR, connect } from './lib.mjs';
import { glbMeta } from './glb.mjs';
import { analyzeMaterials, buildTint } from './tint.mjs';

const MODELS = join(DB_DIR, 'seed', 'furniture');

const CATEGORIES = [
  { slug: 'living', name: 'Living' },
  { slug: 'dining', name: 'Dining' },
  { slug: 'bedroom', name: 'Bedroom' },
  { slug: 'study', name: 'Study' },
];

// Sizes are the real-world dimensions in millimetres: [width, depth, height].
// Width is side to side, depth front to back, height floor to top — the same
// convention the AR scene uses.
const PRODUCTS = [
  {
    slug: 'mahal-3-seater-sofa', category: 'living', name: 'Mahal 3-seater sofa',
    blurb: 'Feather-blend seat, mango-wood frame',
    description: 'A low, deep three-seater with a feather-and-foam blend seat over a kiln-dried mango frame. Loose back cushions, removable covers.',
    size: [2120, 880, 760], price: 64900, mrp: 79900,
    variants: [
      { sku: 'MAHAL-3S-RUST', name: 'Powder Blue', material: 'Boucle', file: 'Sofa.glb', tint: true, isDefault: true },
      { sku: 'MAHAL-3S-FRST', name: 'Forest', material: 'Boucle', file: 'Sofa.glb', tint: true, hex: '#2F4F4A' },
      { sku: 'MAHAL-3S-MIST', name: 'Mist', material: 'Boucle', file: 'Sofa.glb', tint: true, hex: '#7D8794' },
    ],
  },
  {
    slug: 'ira-lounge-chair', category: 'living', name: 'Ira lounge chair',
    blurb: 'Deep seat, low arms',
    description: 'A wide lounge chair with low arms and a sprung seat, sized to sit beside a three-seater without crowding it.',
    size: [780, 820, 940], price: 27500, mrp: 32000,
    variants: [
      { sku: 'IRA-LC-OCHR', name: 'Ochre', material: 'Wool blend', file: 'Chair.glb', tint: true, isDefault: true },
      { sku: 'IRA-LC-INDG', name: 'Indigo', material: 'Wool blend', file: 'Chair.glb', tint: true, hex: '#24415F' },
      { sku: 'IRA-LC-TAN', name: 'Tan', material: 'Wool blend', file: 'Chair.glb', tint: true, hex: '#A8714C' },
    ],
  },
  {
    slug: 'sabha-dining-table', category: 'dining', name: 'Sabha round dining table',
    blurb: 'Seats four, 122 cm top',
    description: 'A 122 cm round top on a turned sheesham base. Seats four comfortably, six at a push.',
    size: [1220, 1220, 750], price: 41200, mrp: 48000,
    variants: [{ sku: 'SABHA-D4-WLNT', name: 'Walnut', material: 'Quartz top', file: 'DiningTable.glb', isDefault: true }],
  },
  {
    slug: 'nook-side-table', category: 'living', name: 'Nook side table',
    blurb: 'Tucks beside any sofa',
    description: 'A small square side table at sofa-arm height, with a lower shelf for books.',
    size: [550, 550, 480], price: 8900, mrp: 11000,
    variants: [{ sku: 'NOOK-ST-OAK', name: 'Natural oak', material: 'Oak veneer', file: 'SideTable.glb', isDefault: true }],
  },
  {
    slug: 'kaam-writing-desk', category: 'study', name: 'Kaam writing desk',
    blurb: 'Cable tray, two drawers',
    description: 'A 140 cm desk with a concealed cable tray along the back edge and two soft-close drawers.',
    size: [1400, 650, 750], price: 22400, mrp: 26500,
    variants: [{ sku: 'KAAM-WD-CHLK', name: 'Chalk', material: 'Engineered oak', file: 'Desk.glb', isDefault: true }],
  },
  {
    slug: 'grid-bookshelf', category: 'study', name: 'Grid bookshelf',
    blurb: '25 cubes, wall-anchored',
    description: 'Five by five open cubes, each sized for a hardback. Ships with a wall-anchor kit, which this one needs.',
    size: [1800, 320, 1850], price: 18700, mrp: 22900,
    variants: [{ sku: 'GRID-25-SNOW', name: 'Snow', material: 'Laminated MDF', file: 'Bookshelf.glb', isDefault: true }],
  },
  {
    slug: 'alcove-wardrobe', category: 'bedroom', name: 'Alcove wardrobe',
    blurb: 'Two doors, open shelving',
    description: 'A two-door wardrobe with a hanging rail on one side and four open shelves on the other.',
    size: [1200, 580, 1900], price: 58000, mrp: 69000,
    variants: [{ sku: 'ALCV-2D-HONY', name: 'Honey', material: 'Sheesham veneer', file: 'Wardrobe.glb', isDefault: true }],
  },
  {
    slug: 'perch-bar-stool', category: 'dining', name: 'Perch bar stool',
    blurb: '74 cm seat, leather top',
    description: 'A 74 cm stool for a standard kitchen island, with a top-grain leather seat over solid acacia.',
    size: [360, 360, 740], price: 6450, mrp: 7800,
    variants: [{ sku: 'PERCH-BS-ESPR', name: 'Espresso', material: 'Top-grain leather', file: 'Stool.glb', isDefault: true }],
  },
  {
    slug: 'halo-floor-lamp', category: 'living', name: 'Halo floor lamp',
    blurb: 'E27, dimmable, 1.5 m cord',
    description: 'A 152 cm floor lamp with a cotton drum shade and an inline dimmer on a 1.5 m cord.',
    size: [400, 400, 1520], price: 5200, mrp: 6400,
    variants: [{ sku: 'HALO-FL-POPY', name: 'Poppy', material: 'Cotton shade', file: 'Lamp.glb', isDefault: true }],
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
      `INSERT INTO product (category_id, slug, name, description, blurb, status,
                            width_mm, depth_mm, height_mm, dimension_unit, price_inr, mrp_inr)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, 'cm', $9, $10)
       ON CONFLICT (slug) DO UPDATE SET
         category_id = EXCLUDED.category_id, name = EXCLUDED.name, description = EXCLUDED.description,
         blurb = EXCLUDED.blurb, status = 'active', width_mm = EXCLUDED.width_mm, depth_mm = EXCLUDED.depth_mm,
         height_mm = EXCLUDED.height_mm, dimension_unit = EXCLUDED.dimension_unit,
         price_inr = EXCLUDED.price_inr, mrp_inr = EXCLUDED.mrp_inr
       RETURNING id`,
      [categoryId.get(p.category), p.slug, p.name, p.description, p.blurb, width, depth, height, p.price, p.mrp],
    );

    let order = 0;
    for (const v of p.variants) {
      const bytes = readFileSync(join(MODELS, v.file));
      const meta = glbMeta(bytes); // also validates the container
      const sha = createHash('sha256').update(bytes).digest('hex');

      // Recolourable colourways share one GLB; `tint` records which materials to repaint.
      let tint = null;
      if (v.tint) {
        const materials = analyzeMaterials(bytes);
        let chosen = materials.filter((m) => m.suggested).map((m) => m.index);
        // A single-material model (fabric and legs baked into one texture) has nothing to tell apart.
        if (!chosen.length && materials.length === 1) chosen = [materials[0].index];
        tint = chosen.length ? buildTint(materials, chosen) : null;
      }

      const { rows: [variant] } = await db.query(
        `INSERT INTO product_variant (product_id, sku, name, material, color_hex, is_default, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, material = EXCLUDED.material,
           color_hex = EXCLUDED.color_hex, is_default = EXCLUDED.is_default, sort_order = EXCLUDED.sort_order
         RETURNING id`,
        [product.id, v.sku, v.name, v.material ?? null, tint ? (v.hex ?? tint.baseHex) : null, Boolean(v.isDefault), order++],
      );

      await db.query(
        `INSERT INTO model_blob (sha256, content, size_bytes) VALUES ($1, $2, $3)
         ON CONFLICT (sha256) DO NOTHING`,
        [sha, bytes, bytes.length],
      );

      const { rows: [current] } = await db.query(
        'SELECT blob_sha256 FROM model_asset WHERE variant_id = $1 AND is_current',
        [variant.id],
      );
      if (current?.blob_sha256 === sha) {
        await db.query('UPDATE model_asset SET tint = $2 WHERE variant_id = $1 AND is_current',
          [variant.id, tint && JSON.stringify(tint)]);
        console.log(`unchanged  ${v.sku.padEnd(14)} ${v.file}`);
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
      console.log(`stored     ${v.sku.padEnd(14)} ${v.file.padEnd(17)} v${next}  ${(bytes.length / 1024).toFixed(0)} KB`);
    }
  }

  await db.query('COMMIT');
  console.log(`\n${PRODUCTS.length} products active. Open /store/nivaas`);
} catch (err) {
  await db.query('ROLLBACK');
  throw err;
} finally {
  await db.end();
}
