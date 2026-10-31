/**
 * Publish-gate tests.
 *
 * The gate exists so a model that is not the product is caught where someone can
 * act on it, instead of being drawn at a confident-looking wrong size.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { validateModel } from './validate.mjs';

const MODELS = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'furniture');
const load = (file) => readFileSync(join(MODELS, file));

const DIMS = {
  'Sofa.glb': { width: 2120, depth: 880, height: 760 },
  'Chair.glb': { width: 780, depth: 820, height: 940 },
  'Bookshelf.glb': { width: 1800, depth: 320, height: 1850 },
  'DiningTable.glb': { width: 1220, depth: 1220, height: 750 },
  'SideTable.glb': { width: 550, depth: 550, height: 480 },
  'Desk.glb': { width: 1400, depth: 650, height: 750 },
  'Wardrobe.glb': { width: 1200, depth: 580, height: 1900 },
  'Stool.glb': { width: 360, depth: 360, height: 740 },
  'Lamp.glb': { width: 400, depth: 400, height: 1520 },
};

const codes = (r) => r.issues.map((i) => i.code);

describe('validateModel — models that match their product', () => {
  for (const file of ['Sofa.glb', 'Chair.glb', 'Bookshelf.glb']) {
    it(`${file} passes the gate`, () => {
      const r = validateModel(load(file), DIMS[file]);
      expect(r.ok).toBe(true);
      expect(r.status).toBe('verified');
      expect(codes(r)).not.toContain('SHAPE_MISMATCH');
    });
  }
});

describe('validateModel — models that are not their product', () => {
  // SOURCE.txt records these as generic Poly stand-ins whose shapes differ.
  for (const file of ['DiningTable.glb', 'SideTable.glb', 'Desk.glb', 'Wardrobe.glb', 'Stool.glb', 'Lamp.glb']) {
    it(`${file} is blocked with SHAPE_MISMATCH`, () => {
      const r = validateModel(load(file), DIMS[file]);
      expect(r.ok).toBe(false);
      expect(codes(r)).toContain('SHAPE_MISMATCH');
      expect(r.status).toBe('approximate');
    });

    it(`${file} is still measured, so the report can say how far off it is`, () => {
      const r = validateModel(load(file), DIMS[file]);
      expect(r.measured.deviation).toBeGreaterThan(0.05);
      expect(r.measured.drawnMm.width).toBeGreaterThan(0);
    });
  }
});

describe('validateModel — dimensions', () => {
  it('blocks a product with no listed size', () => {
    const r = validateModel(load('Chair.glb'), null);
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('NO_DIMENSIONS');
  });

  it('blocks a product whose sides are all null', () => {
    const r = validateModel(load('Chair.glb'), { width: null, depth: null, height: null });
    expect(codes(r)).toContain('NO_DIMENSIONS');
  });

  it('warns, but does not block, when only some sides are listed', () => {
    const r = validateModel(load('Chair.glb'), { width: 780, depth: null, height: null });
    expect(codes(r)).toContain('PARTIAL_DIMENSIONS');
    expect(codes(r)).not.toContain('NO_DIMENSIONS');
  });

  it('blocks an implausible listed size', () => {
    const r = validateModel(load('Chair.glb'), { width: 90000, depth: 90000, height: 90000 });
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('IMPLAUSIBLE');
  });
});

describe('validateModel — file weight', () => {
  it('warns about the 12.8 MB sofa', () => {
    const r = validateModel(load('Sofa.glb'), DIMS['Sofa.glb']);
    expect(codes(r)).toContain('SIZE');
    expect(codes(r)).toContain('TRIANGLES');
    // A warning must not block: the sofa is still the right shape.
    expect(r.ok).toBe(true);
  });

  it('does not warn about a small clean model', () => {
    const r = validateModel(load('Chair.glb'), DIMS['Chair.glb']);
    expect(codes(r)).not.toContain('SIZE');
    expect(codes(r)).not.toContain('TRIANGLES');
  });
});

describe('validateModel — bad input', () => {
  it('rejects bytes that are not a GLB', () => {
    const r = validateModel(Buffer.from('this is not a model'), DIMS['Chair.glb']);
    expect(r.ok).toBe(false);
    expect(codes(r)).toContain('UNREADABLE');
  });
});
