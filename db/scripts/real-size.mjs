// Bring every product's current 3D model to the product's listed size (see
// toRealSize in glb.mjs), as a new model version, so a model uploaded in any
// units, or side-on, shows at real size everywhere: 3D view, AR, Scene Viewer.
//
// A product with no listed size gets the model's own size, once its units are
// plausible (a 111 km file is taken as the wrong unit and corrected by a power of
// ten). Safe to re-run: a model already at its product's size is left alone.
//
//   node db/scripts/real-size.mjs            apply
//   node db/scripts/real-size.mjs --dry-run  only report what would change
import { createHash } from 'node:crypto';
import { connect } from './lib.mjs';
import { PIPELINE_VERSION, authoredSize, glbMeta, toRealSize } from './glb.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
/** A model whose largest side (m) is outside this was saved in the wrong units. */
const PLAUSIBLE = [0.2, 6];
/** Wrong-unit models are brought by a power of ten to near this largest side (m). */
const TYPICAL_LARGEST = 1.2;
/** Beyond this the model is a different shape from the product, not a copy of it. */
const DEVIATION_WARNING = 0.05;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const mm = (v) => (v === null ? null : Number(v));
const percent = (v) => `${Math.round(v * 100)}%`;

/** The model's own size in mm, with clearly wrong units corrected. */
function sizeFromModel(bytes) {
  const s = authoredSize(bytes);
  const largest = Math.max(s.width, s.height, s.depth);
  const ok = largest >= PLAUSIBLE[0] && largest <= PLAUSIBLE[1];
  const k = ok ? 1 : 10 ** Math.round(Math.log10(TYPICAL_LARGEST / largest));
  const r = (m) => Math.round(m * k * 10000) / 10;
  return { width: r(s.width), depth: r(s.depth), height: r(s.height) };
}

const db = connect();
await db.connect();
try {
  await db.query('BEGIN');
  const { rows } = await db.query(
    `SELECT p.id AS product_id, p.name, p.width_mm, p.depth_mm, p.height_mm,
            v.id AS variant_id, v.sku, a.blob_sha256, a.original_filename, a.tint
       FROM product p
       JOIN product_variant v ON v.product_id = p.id
       JOIN model_asset a     ON a.variant_id = v.id AND a.is_current
      ORDER BY p.name, v.sort_order`,
  );
  const products = new Map();
  for (const r of rows) {
    if (!products.has(r.product_id)) products.set(r.product_id, { ...r, variants: [] });
    products.get(r.product_id).variants.push(r);
  }

  let changed = 0;
  for (const p of products.values()) {
    let dims = { width: mm(p.width_mm), depth: mm(p.depth_mm), height: mm(p.height_mm) };
    const blobs = [...new Set(p.variants.map((v) => v.blob_sha256))];
    const content = async (sha) => (await db.query('SELECT content FROM model_blob WHERE sha256 = $1', [sha])).rows[0].content;

    if (dims.width === null && dims.depth === null && dims.height === null) {
      dims = sizeFromModel(await content(blobs[0]));
      console.log(`${p.name}: no size listed; set to the model's own ${dims.width} x ${dims.depth} x ${dims.height} mm (W x D x H)`);
      if (!DRY_RUN) {
        await db.query('UPDATE product SET width_mm = $2, depth_mm = $3, height_mm = $4 WHERE id = $1', [p.product_id, dims.width, dims.depth, dims.height]);
      }
    }

    for (const sha of blobs) {
      const result = toRealSize(await content(sha), dims);
      const next = sha256(result.bytes);
      const users = p.variants.filter((v) => v.blob_sha256 === sha);
      const label = `${p.name} [${users.map((v) => v.sku).join(', ')}] ${users[0].original_filename}`;
      if (next === sha) {
        console.log(`unchanged  ${label}: already at ${result.sizeMm.width} x ${result.sizeMm.depth} x ${result.sizeMm.height} mm`);
        continue;
      }
      const off = result.deviation > DEVIATION_WARNING;
      console.log(
        `${DRY_RUN ? 'would fix' : 'fixed    '}  ${label} -> ${result.sizeMm.width} x ${result.sizeMm.depth} x ${result.sizeMm.height} mm` +
          (result.turned ? ', turned 90 deg (was side-on)' : '') +
          (off
            ? `\n             ${percent(result.deviation)} off the listed ${dims.width} x ${dims.depth} x ${dims.height} mm:` +
              " the model's shape differs from the product, so it is drawn as close as its shape allows and never stretched to fit." +
              ' Replace it with a real model of this product.'
            : ''),
      );
      changed++;
      if (DRY_RUN) continue;

      await db.query('INSERT INTO model_blob (sha256, content, size_bytes) VALUES ($1, $2, $3) ON CONFLICT (sha256) DO NOTHING', [next, result.bytes, result.bytes.length]);
      const meta = JSON.stringify(glbMeta(result.bytes));
      // How this asset was derived, so a later pipeline version can find and redo it.
      const normalization = JSON.stringify({
        pipelineVersion: PIPELINE_VERSION,
        status: result.status,
        factor: result.factor,
        turned: result.turned,
        deviation: result.deviation,
        sourceSha256: sha,
        targetMm: result.targetMm,
        drawnMm: result.sizeMm,
      });
      for (const v of users) {
        const { rows: [{ version }] } = await db.query('SELECT COALESCE(MAX(version), 0) + 1 AS version FROM model_asset WHERE variant_id = $1', [v.variant_id]);
        await db.query('UPDATE model_asset SET is_current = false WHERE variant_id = $1 AND is_current', [v.variant_id]);
        await db.query(
          `INSERT INTO model_asset (variant_id, blob_sha256, version, is_current, original_filename, meta, tint, normalization)
           VALUES ($1, $2, $3, true, $4, $5, $6, $7)`,
          [v.variant_id, next, version, v.original_filename, meta, v.tint && JSON.stringify(v.tint), normalization],
        );
      }
    }
  }

  await db.query(DRY_RUN ? 'ROLLBACK' : 'COMMIT');
  console.log(`\n${changed} model(s) ${DRY_RUN ? 'would be' : 'were'} brought to real size.${DRY_RUN ? ' Nothing was changed (dry run).' : ' Previous versions are kept in model_asset.'}`);
} catch (err) {
  await db.query('ROLLBACK');
  throw err;
} finally {
  await db.end();
}
