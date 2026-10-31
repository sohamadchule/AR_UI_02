/**
 * Resizing regression tests.
 *
 * Covers the rules a customer-facing resize has to keep: proportions, per-piece
 * independence, grounding, rotation, collision and fit recalculation, and an
 * exact return to the listed size.
 *
 * These are software tests of the maths. Whether a resized sofa measures what it
 * claims on a real floor still needs a tape measure — see docs/ar-test-plan.md.
 */
import { describe, expect, it } from 'vitest';

import { RESIZE_MAX, RESIZE_MIN, clampScale, isResized, scaleForSide, sideRangeMm, sizeAt, type Size3 } from '@/lib/resize';
import { corners, evaluateLayout, penetration, type Footprint } from '@/lib/room';
import { checkFit } from '@/lib/fit';

/** The Mahal sofa at its listed size, in metres. */
const SOFA: Size3 = { width: 2.12, depth: 0.88, height: 0.76 };

/** What the engine builds from a piece: position, turn, and the size as drawn. */
const footprintOf = (size: Size3, x = 0, z = 0, yaw = 0, y = 0): Footprint => ({
  x,
  z,
  width: size.width,
  depth: size.depth,
  yaw,
  bottom: y,
  top: y + size.height,
});

describe('proportions are kept', () => {
  it('scales every side by the same factor', () => {
    const s = sizeAt(SOFA, 1.5);
    expect(s.width).toBeCloseTo(3.18, 9);
    expect(s.depth).toBeCloseTo(1.32, 9);
    expect(s.height).toBeCloseTo(1.14, 9);
  });

  it('keeps the width:depth:height ratios exactly', () => {
    for (const k of [0.5, 0.73, 1, 1.37, 2]) {
      const s = sizeAt(SOFA, k);
      expect(s.width / s.depth).toBeCloseTo(SOFA.width / SOFA.depth, 12);
      expect(s.height / s.width).toBeCloseTo(SOFA.height / SOFA.width, 12);
    }
  });

  it('setting one side moves the others with it', () => {
    // "I need it 180 cm wide" — the depth and height follow.
    const k = scaleForSide(SOFA, 'width', 1800)!;
    const s = sizeAt(SOFA, k);
    expect(s.width).toBeCloseTo(1.8, 9);
    expect(s.depth).toBeCloseTo(SOFA.depth * (1.8 / SOFA.width), 9);
    expect(s.height).toBeCloseTo(SOFA.height * (1.8 / SOFA.width), 9);
  });

  it('can be driven from the depth or the height too', () => {
    expect(sizeAt(SOFA, scaleForSide(SOFA, 'depth', 660)!).depth).toBeCloseTo(0.66, 9);
    expect(sizeAt(SOFA, scaleForSide(SOFA, 'height', 570)!).height).toBeCloseTo(0.57, 9);
  });
});

describe('limits', () => {
  it('clamps below the minimum', () => expect(clampScale(0.01)).toBe(RESIZE_MIN));
  it('clamps above the maximum', () => expect(clampScale(99)).toBe(RESIZE_MAX));
  it('leaves a sensible factor alone', () => expect(clampScale(1.25)).toBe(1.25));

  it('clamps a typed side that is out of range', () => {
    // 10 m wide is not this sofa, whatever was typed.
    expect(scaleForSide(SOFA, 'width', 10_000)).toBe(RESIZE_MAX);
    expect(scaleForSide(SOFA, 'width', 10)).toBe(RESIZE_MIN);
  });

  it('refuses nonsense input rather than guessing', () => {
    expect(scaleForSide(SOFA, 'width', 0)).toBeNull();
    expect(scaleForSide(SOFA, 'width', -5)).toBeNull();
    expect(scaleForSide(SOFA, 'width', Number.NaN)).toBeNull();
    expect(scaleForSide({ width: 0, height: 1, depth: 1 }, 'width', 100)).toBeNull();
  });

  it('reports the range a side may be set to', () => {
    const [lo, hi] = sideRangeMm(SOFA, 'width');
    expect(lo).toBeCloseTo(1060, 6);
    expect(hi).toBeCloseTo(4240, 6);
  });
});

describe('resetting to the listed size', () => {
  it('returns the original dimensions exactly', () => {
    const resized = sizeAt(SOFA, 1.4);
    expect(resized.width).not.toBeCloseTo(SOFA.width, 6);
    const reset = sizeAt(SOFA, 1);
    expect(reset).toEqual(SOFA);
  });

  it('does not compound: a run of resizes equals the last one alone', () => {
    // The engine always derives the drawn size from baseSize, never from the
    // size currently on screen. This is what stops a resize stacking on top of
    // the earlier normalisation, or on top of itself.
    let size = { ...SOFA };
    let scale = 1;
    for (const widthMm of [1800, 2600, 1200, 3000]) {
      scale = scaleForSide(SOFA, 'width', widthMm)!; // always from the base
      size = sizeAt(SOFA, scale);
    }
    // Four resizes later, the result is exactly the single last request.
    expect(size).toEqual(sizeAt(SOFA, scaleForSide(SOFA, 'width', 3000)!));
    expect(size.width).toBeCloseTo(3.0, 9);

    // And this is what the alternative would have cost. Scaling the size that is
    // already on screen makes each clamp relative to the last result, so the
    // sequence drifts and the customer stops getting the size they asked for.
    let compounded = { ...SOFA };
    for (const widthMm of [1800, 2600, 1200, 3000]) {
      compounded = sizeAt(compounded, scaleForSide(compounded, 'width', widthMm)!);
    }
    expect(compounded.width).toBeCloseTo(2.6, 9); // asked for 3.00 m, got 2.60 m
    expect(Math.abs(compounded.width - 3)).toBeGreaterThan(0.3);

    // Resetting still lands exactly on the listing, because it too reads the base.
    expect(sizeAt(SOFA, 1)).toEqual(SOFA);
  });

  it('honours a request the compounded route would have clamped away', () => {
    // 120 cm is well inside the range measured from the listed 212 cm, but
    // outside a half-step measured from an already-shrunk 260 cm.
    expect(sizeAt(SOFA, scaleForSide(SOFA, 'width', 1200)!).width).toBeCloseTo(1.2, 9);
    const shrunk = sizeAt(SOFA, scaleForSide(SOFA, 'width', 2600)!);
    expect(sizeAt(shrunk, scaleForSide(shrunk, 'width', 1200)!).width).toBeCloseTo(1.3, 9);
  });

  it('knows when a piece is no longer at its listed size', () => {
    expect(isResized(1)).toBe(false);
    expect(isResized(1.0005)).toBe(false);
    expect(isResized(1.2)).toBe(true);
    expect(isResized(0.5)).toBe(true);
  });
});

describe('the catalogue is never written to', () => {
  it('leaves the base size untouched', () => {
    const base: Size3 = { ...SOFA };
    sizeAt(base, 1.75);
    scaleForSide(base, 'width', 1200);
    expect(base).toEqual(SOFA);
  });
});

describe('each placed piece has its own size', () => {
  it('two copies of one product can differ', () => {
    const a = sizeAt(SOFA, 1);
    const b = sizeAt(SOFA, 1.5);
    expect(a.width).toBeCloseTo(2.12, 9);
    expect(b.width).toBeCloseTo(3.18, 9);
  });

  it('resizing one does not move the other', () => {
    const base: Size3 = { ...SOFA };
    const first = sizeAt(base, 1.2);
    const second = sizeAt(base, 0.6);
    // Recomputing the first from the untouched base gives the same answer.
    expect(sizeAt(base, 1.2)).toEqual(first);
    expect(second.width).toBeCloseTo(1.272, 9);
  });
});

describe('grounding survives a resize', () => {
  it('keeps the base on the floor', () => {
    // The model rests on y = 0 inside its group, so scaling about the group's
    // origin leaves the bottom at the floor: 0 x k is still 0.
    for (const k of [0.5, 1, 1.4, 2]) {
      const fp = footprintOf(sizeAt(SOFA, k), 0, 0, 0, 0);
      expect(fp.bottom).toBe(0);
      expect(fp.top).toBeCloseTo(SOFA.height * k, 9);
    }
  });

  it('keeps a piece standing on a table at the table top', () => {
    const tableTop = 0.75;
    const fp = footprintOf(sizeAt({ width: 0.3, height: 0.4, depth: 0.3 }, 1.5), 0, 0, 0, tableTop);
    expect(fp.bottom).toBe(tableTop);
    expect(fp.top).toBeCloseTo(tableTop + 0.6, 9);
  });

  it('leaves the footprint centred on the piece position', () => {
    const fp = footprintOf(sizeAt(SOFA, 1.8), 2, -3);
    const xs = corners(fp).map(([x]) => x);
    const zs = corners(fp).map(([, z]) => z);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(2, 9);
    expect((Math.min(...zs) + Math.max(...zs)) / 2).toBeCloseTo(-3, 9);
  });
});

describe('rotation stays independent of size', () => {
  it('gives the same corners whether you scale then turn, or turn then scale', () => {
    // A uniform scale commutes with a rotation, which is why the engine can keep
    // them on the same group without one disturbing the other. Checked about the
    // origin so the two routes are comparable.
    const yaw = Math.PI / 5;
    const k = 1.3;
    const scaleThenTurn = corners(footprintOf(sizeAt(SOFA, k), 0, 0, yaw));
    // Turn at the listed size, then scale the resulting coordinates by hand.
    const turnThenScale = corners(footprintOf(SOFA, 0, 0, yaw)).map(([x, z]) => [x * k, z * k]);

    expect(scaleThenTurn).toHaveLength(4);
    for (const [i, [x, z]] of scaleThenTurn.entries()) {
      expect(x).toBeCloseTo(turnThenScale[i][0], 12);
      expect(z).toBeCloseTo(turnThenScale[i][1], 12);
    }
    // Guard against both routes collapsing to zero and passing trivially.
    expect(Math.max(...scaleThenTurn.map(([x]) => Math.abs(x)))).toBeGreaterThan(0.5);
  });

  it('does not change the turn when the size changes', () => {
    const yaw = 0.7;
    expect(footprintOf(sizeAt(SOFA, 0.6), 0, 0, yaw).yaw).toBe(yaw);
    expect(footprintOf(sizeAt(SOFA, 1.9), 0, 0, yaw).yaw).toBe(yaw);
  });

  it('turns the enlarged footprint, not the original', () => {
    const big = corners(footprintOf(sizeAt(SOFA, 2), 0, 0, Math.PI / 2));
    // Turned a quarter, the 4.24 m width now runs along z.
    const zs = big.map(([, z]) => z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(SOFA.width * 2, 6);
  });
});

describe('collision is recalculated from the drawn size', () => {
  const chair: Size3 = { width: 0.78, height: 0.94, depth: 0.82 };

  it('a piece that cleared its neighbour overlaps once enlarged', () => {
    const a = footprintOf(chair, 0, 0);
    const clear = footprintOf(chair, 1, 0);
    expect(penetration(corners(a), corners(clear))).toBeLessThanOrEqual(0);

    const enlarged = footprintOf(sizeAt(chair, 2), 1, 0);
    expect(penetration(corners(a), corners(enlarged))).toBeGreaterThan(0);
  });

  it('an overlapping piece clears once shrunk', () => {
    const a = footprintOf(chair, 0, 0);
    const overlapping = footprintOf(sizeAt(chair, 2), 0.8, 0);
    expect(penetration(corners(a), corners(overlapping))).toBeGreaterThan(0);

    const shrunk = footprintOf(sizeAt(chair, 0.5), 0.8, 0);
    expect(penetration(corners(a), corners(shrunk))).toBeLessThanOrEqual(0);
  });

  it('the layout report follows a resize', () => {
    const pieces = (scale: number) => [
      { id: 'a', footprint: footprintOf(chair, 0, 0), companion: false },
      { id: 'b', footprint: footprintOf(sizeAt(chair, scale), 1.1, 0), companion: false },
    ];
    expect(evaluateLayout(pieces(1), null).status.b).not.toBe('collision');
    expect(evaluateLayout(pieces(2), null).status.b).toBe('collision');
  });

  it('a resized piece can be pushed outside the room', () => {
    // A 3 m square room; the piece only crosses a wall once enlarged.
    const room: [number, number][] = [
      [-1.5, -1.5],
      [1.5, -1.5],
      [1.5, 1.5],
      [-1.5, 1.5],
    ];
    const at = (scale: number) => [{ id: 'a', footprint: footprintOf(sizeAt(chair, scale), 1, 0), companion: false }];
    expect(evaluateLayout(at(1), room).status.a).not.toBe('outside');
    expect(evaluateLayout(at(2), room).status.a).toBe('outside');
  });
});

describe('fit checking uses the drawn size, not the listing', () => {
  const space = { width: 2000, depth: 1000, height: null };
  const mm = (s: Size3) => ({ width: s.width * 1000, depth: s.depth * 1000, height: s.height * 1000 });

  it('the listed sofa is too wide for a 200 cm space', () => {
    expect(checkFit(mm(SOFA), space).status).toBe('too-big');
  });

  it('the same sofa fits once resized down', () => {
    const smaller = sizeAt(SOFA, scaleForSide(SOFA, 'width', 1900)!);
    expect(checkFit(mm(smaller), space).status).toBe('fits');
  });

  it('and is too big again after a reset', () => {
    expect(checkFit(mm(sizeAt(SOFA, 1)), space).status).toBe('too-big');
  });

  it('never resizes the product to make it fit by itself', () => {
    // checkFit reports; only an explicit resize changes the piece.
    const { lines } = checkFit(mm(SOFA), space);
    expect(lines.join(' ')).toMatch(/too wide/);
  });
});
