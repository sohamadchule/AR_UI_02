/**
 * Geometry, fit and real-size tests.
 *
 * These cover the pure modules the AR engine depends on: they import nothing
 * from the browser or three.js, so they run in plain Node in milliseconds.
 *
 * They prove the MATHS is right. They prove nothing about what a phone draws on
 * a real floor — that needs a tape measure and is tracked separately in
 * docs/ar-test-plan.md.
 */
import { describe, expect, it } from 'vitest';

import { COMPANION_GAP, WALKWAY, corners, nearest, penetration, type Footprint } from '@/lib/room';
import { checkFit } from '@/lib/fit';
import { isPlaceable, resolveTrueScale } from '@/lib/trueScale';
import { UNITS, formatLength, fromMm } from '@/lib/units';

const fp = (x: number, z: number, width: number, depth: number, yaw = 0, bottom = 0, top = 0.8): Footprint =>
  ({ x, z, width, depth, yaw, bottom, top });

describe('room.ts — separating-axis overlap', () => {
  it('reports overlap for identical footprints', () => {
    expect(penetration(corners(fp(0, 0, 1, 1)), corners(fp(0, 0, 1, 1)))).toBeGreaterThan(0);
  });

  it('reports no overlap when a metre apart', () => {
    expect(penetration(corners(fp(0, 0, 1, 1)), corners(fp(2, 0, 1, 1)))).toBeLessThanOrEqual(0);
  });

  it('treats exactly touching as zero overlap', () => {
    expect(Math.abs(penetration(corners(fp(0, 0, 1, 1)), corners(fp(1, 0, 1, 1))))).toBeLessThan(1e-9);
  });

  it('measures how deep two footprints interpenetrate', () => {
    expect(penetration(corners(fp(0, 0, 1, 1)), corners(fp(0.9, 0, 1, 1)))).toBeCloseTo(0.1, 9);
  });

  // A square turned 45 deg reaches further along an axis than its width suggests.
  // An axis-aligned check would miss this; the SAT must not.
  it('accounts for rotation: a 45 deg neighbour at 1.2 m still overlaps', () => {
    expect(penetration(corners(fp(0, 0, 1, 1)), corners(fp(1.2, 0, 1, 1, Math.PI / 4)))).toBeGreaterThan(0);
  });

  it('accounts for rotation: the same neighbour is clear at 1.6 m', () => {
    expect(penetration(corners(fp(0, 0, 1, 1)), corners(fp(1.6, 0, 1, 1, Math.PI / 4)))).toBeLessThanOrEqual(0);
  });
});

describe('room.ts — nearest-point gap', () => {
  it('measures the clear floor distance between two footprints', () => {
    expect(nearest(corners(fp(0, 0, 1, 1)), corners(fp(2, 0, 1, 1))).distance).toBeCloseTo(1, 9);
  });

  it('puts a 40 cm gap between the companion gap and the walkway', () => {
    const { distance } = nearest(corners(fp(0, 0, 1, 1)), corners(fp(1.4, 0, 1, 1)));
    expect(distance).toBeGreaterThan(COMPANION_GAP);
    expect(distance).toBeLessThan(WALKWAY);
  });
});

describe('fit.ts', () => {
  const sofa = { width: 2120, depth: 880, height: 760 };

  it('reports a sofa as too big for a narrow space', () => {
    expect(checkFit(sofa, { width: 2000, depth: 900, height: null }).status).toBe('too-big');
  });

  it('says by how much, in centimetres', () => {
    const { lines } = checkFit(sofa, { width: 2000, depth: 900, height: null });
    expect(lines.some((l) => l.includes('12 cm too wide'))).toBe(true);
  });

  it('reports a fit when the space is large enough', () => {
    expect(checkFit(sofa, { width: 2200, depth: 1000, height: null }).status).toBe('fits');
  });

  it('is unknown without product dimensions', () => {
    expect(checkFit(null, { width: 2200, depth: 1000, height: null }).status).toBe('unknown');
  });

  it('is unknown without a measured space', () => {
    expect(checkFit(sofa, { width: null, depth: null, height: null }).status).toBe('unknown');
  });

  it('offers a turned orientation when only that fits', () => {
    expect(checkFit(sofa, { width: 900, depth: 2200, height: null }).status).toBe('fits-turned');
  });

  it('never resizes the product to make it fit', () => {
    // A 212 cm sofa in a 200 cm space is 12 cm too wide, not a 200 cm sofa.
    const { lines } = checkFit(sofa, { width: 2000, depth: 900, height: null });
    expect(lines.join(' ')).not.toMatch(/scaled|resized|shrunk/i);
  });
});

describe('trueScale.ts', () => {
  it('accepts a model that already matches its listed size', () => {
    const r = resolveTrueScale({ width: 1.004, height: 0.356, depth: 0.433 }, { width: 2120, height: 760, depth: 880 });
    expect(r.status).toBe('verified');
  });

  it('rescues a model authored in absurd units (111 km chair)', () => {
    const r = resolveTrueScale({ width: 111013, height: 137411, depth: 115924 }, { width: 780, height: 940, depth: 820 });
    expect(r.status).toBe('verified');
    expect(r.scale).toBeLessThan(1e-4);
  });

  it('detects a model authored side-on', () => {
    const r = resolveTrueScale({ width: 18.14, height: 100, depth: 100 }, { width: 1800, height: 1850, depth: 320 });
    expect(r.swapWidthDepth).toBe(true);
  });

  it('corrects clearly wrong units by a power of ten when no size is listed', () => {
    const r = resolveTrueScale({ width: 1200, height: 900, depth: 600 }, null);
    expect(r.status).toBe('no-dimensions');
    expect(r.scale).toBeLessThan(1);
  });

  it('never returns a non-uniform correction', () => {
    // resolveTrueScale returns a single scalar by construction: a model whose
    // shape differs from the product is reported, never stretched to fit.
    const r = resolveTrueScale({ width: 1, height: 2, depth: 3 }, { width: 1000, height: 1000, depth: 1000 });
    expect(typeof r.scale).toBe('number');
    expect(r.status).toBe('approximate');
  });

  it('accepts a chair-sized object as placeable', () => {
    expect(isPlaceable({ width: 0.83, height: 0.69, depth: 0.57 })).toBe(true);
  });

  it('refuses a 687 km desk', () => {
    expect(isPlaceable({ width: 686929, height: 347659, depth: 400026 })).toBe(false);
  });

  it('refuses a 1 cm speck', () => {
    expect(isPlaceable({ width: 0.01, height: 0.01, depth: 0.01 })).toBe(false);
  });
});

describe('units.ts', () => {
  it('converts millimetres for display', () => {
    expect(fromMm(520, 'cm')).toBe(52);
    expect(formatLength(520, 'cm')).toBe('52 cm');
  });

  it('keeps millimetres as the stored unit', () => {
    expect(UNITS.mm.perMm).toBe(1);
  });
});
