// Quality gate for a product's 3D model.
//
// Run at ingest, where a human can still act, rather than at render time where
// the only options are to draw something wrong or draw nothing. A model that
// fails here is not the product: no runtime maths can fix that, so the pipeline
// reports it instead of hiding it.
//
// Used by the admin upload route (blocks) and by the seed/real-size scripts
// (reports). Pure and dependency-free, so it is unit-testable.

import { TOLERANCE, glbMeta, toRealSize } from './glb.mjs';

export const LIMITS = {
  /** Shopify's published mobile-web budget, which the market doc cites, is about this. */
  maxBytes: 5_000_000,
  maxTriangles: 150_000,
  maxTextureBytes: 3_000_000,
  /** Largest side, metres. Outside this it cannot be a piece of furniture. */
  placeable: [0.05, 6],
  /** Worst side may disagree with the listing by this much and still be that product. */
  tolerance: TOLERANCE,
};

const FAIL = 'fail';
const WARN = 'warn';

/**
 * Check a GLB against a product's listed dimensions.
 *
 * `dimsMm` is { width, depth, height } in millimetres, any side nullable.
 * Returns { ok, level, status, normalization, measured, issues[] } where each
 * issue is { level, code, message }. `ok` is false only for FAIL-level issues,
 * so a caller can block publication while still storing the asset.
 */
export function validateModel(bytes, dimsMm) {
  const issues = [];
  const add = (level, code, message) => issues.push({ level, code, message });

  let meta;
  try {
    meta = glbMeta(bytes);
  } catch (err) {
    return {
      ok: false,
      level: FAIL,
      status: null,
      measured: null,
      issues: [{ level: FAIL, code: 'UNREADABLE', message: err.message }],
    };
  }

  if (!meta.bbox_m) {
    return {
      ok: false,
      level: FAIL,
      status: null,
      measured: null,
      issues: [{ level: FAIL, code: 'NO_GEOMETRY', message: 'The file has no geometry to measure.' }],
    };
  }

  // --- weight ---------------------------------------------------------------
  if (bytes.length > LIMITS.maxBytes) {
    add(WARN, 'SIZE', `${(bytes.length / 1e6).toFixed(2)} MB is over the ${LIMITS.maxBytes / 1e6} MB budget; it will be slow to open in AR.`);
  }
  if (meta.triangles > LIMITS.maxTriangles) {
    add(WARN, 'TRIANGLES', `${meta.triangles.toLocaleString('en')} triangles is over the ${LIMITS.maxTriangles.toLocaleString('en')} budget.`);
  }
  if (meta.texture_bytes > LIMITS.maxTextureBytes) {
    add(WARN, 'TEXTURES', `${(meta.texture_bytes / 1e6).toFixed(2)} MB of textures; compress them (KTX2) before publishing.`);
  }

  // --- dimensions -----------------------------------------------------------
  const listed = ['width', 'depth', 'height'].filter((a) => dimsMm?.[a]);
  if (!listed.length) {
    add(FAIL, 'NO_DIMENSIONS', 'The product has no listed size, so the model cannot be shown at a size we can stand behind.');
    return finish(issues, meta, null, null);
  }
  if (listed.length < 3) {
    const missing = ['width', 'depth', 'height'].filter((a) => !dimsMm?.[a]);
    add(WARN, 'PARTIAL_DIMENSIONS', `No ${missing.join(' or ')} listed; ${missing.length === 1 ? 'that side follows' : 'those sides follow'} the model's own proportions.`);
  }

  let normalized;
  try {
    normalized = toRealSize(bytes, dimsMm);
  } catch (err) {
    add(FAIL, 'NOT_NORMALISABLE', err.message);
    return finish(issues, meta, null, null);
  }

  const largest = Math.max(...Object.values(normalized.sizeMm)) / 1000;
  if (largest < LIMITS.placeable[0] || largest > LIMITS.placeable[1]) {
    add(FAIL, 'IMPLAUSIBLE', `At its listed size the largest side is ${largest.toFixed(2)} m, which is not a believable piece of furniture.`);
  }

  if (normalized.deviation > LIMITS.tolerance) {
    add(
      FAIL,
      'SHAPE_MISMATCH',
      `The model's shape differs from the listed size by up to ${Math.round(normalized.deviation * 100)}%. ` +
        'It is drawn to the closest size its shape allows and never stretched to fit, so this model is not this product. Replace it.',
    );
  } else if (normalized.deviation > 0.02) {
    add(WARN, 'SHAPE_DRIFT', `The model is up to ${(normalized.deviation * 100).toFixed(1)}% off the listed size.`);
  }

  return finish(issues, meta, normalized.status, normalized);
}

function finish(issues, meta, status, normalized) {
  const level = issues.some((i) => i.level === FAIL) ? FAIL : issues.some((i) => i.level === WARN) ? WARN : 'ok';
  return {
    ok: level !== FAIL,
    level,
    status,
    issues,
    measured: {
      bytes: meta.bytes ?? null,
      triangles: meta.triangles,
      textureBytes: meta.texture_bytes,
      authoredM: meta.bbox_m?.size ?? null,
      drawnMm: normalized?.sizeMm ?? null,
      deviation: normalized?.deviation ?? null,
      turned: normalized?.turned ?? null,
      factor: normalized?.factor ?? null,
    },
  };
}

/** One line per issue, for a console script. */
export const describeIssues = (result) => result.issues.map((i) => `  [${i.level.toUpperCase()}] ${i.code}: ${i.message}`).join('\n');
