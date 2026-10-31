/**
 * Canonical asset pipeline tests.
 *
 * These run against the real seed GLBs and the real catalogue dimensions, so
 * they check the thing that matters: a normalised model MEASURES the size the
 * catalogue lists. They are software tests — they say nothing about what a phone
 * draws on a floor. Physical validation is tracked in docs/ar-test-plan.md.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PIPELINE_VERSION, TOLERANCE, authoredSize, glbMeta, normalizationOf, readGlb, toRealSize } from './glb.mjs';

const MODELS = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'furniture');
const load = (file) => readFileSync(join(MODELS, file));
const sha = (b) => createHash('sha256').update(b).digest('hex');

/** The live store catalogue: [name, file, { width, depth, height } in mm]. */
const CATALOGUE = [
  ['Mahal 3-seater sofa', 'Sofa.glb', { width: 2120, depth: 880, height: 760 }],
  ['Ira lounge chair', 'Chair.glb', { width: 780, depth: 820, height: 940 }],
  ['Sabha round dining table', 'DiningTable.glb', { width: 1220, depth: 1220, height: 750 }],
  ['Nook side table', 'SideTable.glb', { width: 550, depth: 550, height: 480 }],
  ['Kaam writing desk', 'Desk.glb', { width: 1400, depth: 650, height: 750 }],
  ['Grid bookshelf', 'Bookshelf.glb', { width: 1800, depth: 320, height: 1850 }],
  ['Alcove wardrobe', 'Wardrobe.glb', { width: 1200, depth: 580, height: 1900 }],
  ['Perch bar stool', 'Stool.glb', { width: 360, depth: 360, height: 740 }],
  ['Halo floor lamp', 'Lamp.glb', { width: 400, depth: 400, height: 1520 }],
];

/** Measured size of a GLB as drawn, in millimetres. */
function drawnMm(bytes) {
  const s = glbMeta(bytes).bbox_m.size;
  return { width: s[0] * 1000, height: s[1] * 1000, depth: s[2] * 1000 };
}

/** The matrix of the root node this pipeline adds. */
function rootMatrix(bytes) {
  const gltf = readGlb(bytes);
  const root = gltf.nodes[gltf.scenes[gltf.scene ?? 0].nodes[0]];
  expect(root.name).toBe('akruti-real-size');
  return root.matrix;
}

/** Lengths of a column-major matrix's three basis vectors. */
const basisLengths = (m) => [0, 1, 2].map((c) => Math.hypot(m[c * 4], m[c * 4 + 1], m[c * 4 + 2]));

describe('toRealSize — every catalogue model', () => {
  for (const [name, file, dims] of CATALOGUE) {
    describe(name, () => {
      const out = toRealSize(load(file), dims);
      const drawn = drawnMm(out.bytes);
      const bbox = glbMeta(out.bytes).bbox_m;

      it('is placed with its base on y = 0', () => {
        expect(bbox.min[1]).toBeCloseTo(0, 3);
      });

      it('has its footprint centred on the origin', () => {
        expect((bbox.min[0] + bbox.max[0]) / 2).toBeCloseTo(0, 3);
        expect((bbox.min[2] + bbox.max[2]) / 2).toBeCloseTo(0, 3);
      });

      it('keeps the model to a believable furniture size', () => {
        const largest = Math.max(...bbox.size);
        expect(largest).toBeGreaterThan(0.05);
        expect(largest).toBeLessThan(6);
      });

      it('is stamped with the pipeline version', () => {
        const stamp = normalizationOf(out.bytes);
        expect(stamp.normalized).toBe(true);
        expect(stamp.pipelineVersion).toBe(PIPELINE_VERSION);
        expect(stamp.factor).toBeGreaterThan(0);
      });

      it('reports a status consistent with its deviation', () => {
        expect(out.status).toBe(out.deviation <= TOLERANCE ? 'verified' : 'approximate');
      });

      // The heart of it: a VERIFIED model must measure what the catalogue lists.
      if (true) {
        it('measures its declared size when verified, or reports how far off', () => {
          if (out.status !== 'verified') {
            expect(out.deviation).toBeGreaterThan(TOLERANCE);
            return;
          }
          for (const axis of ['width', 'depth', 'height']) {
            expect(Math.abs(drawn[axis] - dims[axis]) / dims[axis]).toBeLessThanOrEqual(TOLERANCE);
          }
        });
      }

      it('is normalised by a single uniform factor, never stretched per axis', () => {
        // Checked on the transform itself rather than on measured bounds, which
        // boundsOf rounds to 0.1 mm. The three basis vectors of the root node's
        // matrix must have the same length: that IS "no non-uniform stretch".
        const [sx, sy, sz] = basisLengths(rootMatrix(out.bytes));
        expect(sy).toBeCloseTo(sx, 12);
        expect(sz).toBeCloseTo(sx, 12);
        expect(sx).toBeCloseTo(out.factor, 12);
      });
    });
  }
});

describe('toRealSize — idempotence', () => {
  for (const [name, file, dims] of CATALOGUE) {
    it(`${name}: normalising twice changes nothing`, () => {
      const once = toRealSize(load(file), dims);
      const twice = toRealSize(once.bytes, dims);
      expect(sha(twice.bytes)).toBe(sha(once.bytes));
    });

    it(`${name}: re-normalising does not change the drawn size`, () => {
      const once = toRealSize(load(file), dims);
      const twice = toRealSize(once.bytes, dims);
      const a = drawnMm(once.bytes);
      const b = drawnMm(twice.bytes);
      expect(b.width).toBeCloseTo(a.width, 6);
      expect(b.height).toBeCloseTo(a.height, 6);
      expect(b.depth).toBeCloseTo(a.depth, 6);
    });

    it(`${name}: the factor is derived from the authored geometry, not compounded`, () => {
      const once = toRealSize(load(file), dims);
      const twice = toRealSize(once.bytes, dims);
      expect(twice.factor).toBeCloseTo(once.factor, 9);
    });
  }
});

describe('toRealSize — the three models that match their listing', () => {
  // SOURCE.txt records that only these three have shapes matching the product.
  for (const file of ['Sofa.glb', 'Chair.glb', 'Bookshelf.glb']) {
    const [, , dims] = CATALOGUE.find(([, f]) => f === file);
    it(`${file} resolves to verified`, () => {
      expect(toRealSize(load(file), dims).status).toBe('verified');
    });
  }
});

describe('toRealSize — edge cases', () => {
  it('refuses a model with no target size', () => {
    expect(() => toRealSize(load('Chair.glb'), {})).toThrow(/No target size/);
  });

  it('follows the model proportions for sides the catalogue leaves out', () => {
    const dims = { width: 780, depth: null, height: null };
    const out = toRealSize(load('Chair.glb'), dims);
    const drawn = drawnMm(out.bytes);
    expect(drawn.width).toBeCloseTo(780, 0);
    // Height and depth were not listed, so they follow the model's own shape.
    const a = authoredSize(load('Chair.glb'));
    expect(drawn.height / drawn.width).toBeCloseTo(a.height / a.width, 4);
  });

  it('turns a model authored side-on', () => {
    // Bookshelf is authored with its width along z.
    expect(toRealSize(load('Bookshelf.glb'), { width: 1800, depth: 320, height: 1850 }).turned).toBe(true);
  });

  it('leaves the original bytes untouched', () => {
    const original = load('Chair.glb');
    const before = sha(original);
    toRealSize(original, { width: 780, depth: 820, height: 940 });
    expect(sha(original)).toBe(before);
  });

  it('preserves the copyright notice', () => {
    // Attribution must survive normalisation: these assets are CC-BY.
    const src = load('Sofa.glb');
    const out = toRealSize(src, { width: 2120, depth: 880, height: 760 });
    expect(glbMeta(out.bytes).generator).toBe(glbMeta(src).generator);
  });

  it('preserves mesh and material counts, so tint indices still line up', () => {
    const src = load('Sofa.glb');
    const a = glbMeta(src);
    const b = glbMeta(toRealSize(src, { width: 2120, depth: 880, height: 760 }).bytes);
    expect(b.meshes).toBe(a.meshes);
    expect(b.materials).toBe(a.materials);
    expect(b.textures).toBe(a.textures);
  });
});
