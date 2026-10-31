/**
 * Customer resizing of a placed piece.
 *
 * Separate from `trueScale`, and deliberately so. `trueScale` answers "how big is
 * this product really?" once, at ingest, against the catalogue. This answers "how
 * big does this one customer want THIS one copy to look?", at a point where the
 * catalogue must not change. Keeping them apart is what stops a resize being
 * mistaken for a correction, or a correction being applied twice.
 *
 * Pure: no three.js, no browser. The AR engine applies the factor to a piece's
 * own group; everything that decides the number lives here and is unit-tested.
 */

export interface Size3 {
  width: number;
  height: number;
  depth: number;
}

/**
 * How far a customer may resize a piece either side of its real size.
 *
 * Wide enough to try a smaller sofa or a longer table, narrow enough that the
 * result is still recognisably the product.
 */
export const RESIZE_MIN = 0.5;
export const RESIZE_MAX = 2;

/** A piece counts as resized once it is this far from its listed size. */
const RESIZED_EPS = 0.001;

export const clampScale = (scale: number): number =>
  Math.min(RESIZE_MAX, Math.max(RESIZE_MIN, scale));

/**
 * The drawn size at a given factor.
 *
 * One factor for every side, so the piece keeps its proportions: a narrower sofa
 * is a smaller sofa, not a squashed one. Per-axis sizing is not offered here —
 * a distorted preview is not the product.
 */
export const sizeAt = (base: Size3, scale: number): Size3 => ({
  width: base.width * scale,
  height: base.height * scale,
  depth: base.depth * scale,
});

/** The factor that makes one side measure `mm`, or null if that can't be read. */
export function scaleForSide(base: Size3, axis: keyof Size3, mm: number): number | null {
  const side = base[axis];
  if (!(side > 0) || !Number.isFinite(mm) || mm <= 0) return null;
  return clampScale(mm / 1000 / side);
}

export const isResized = (scale: number): boolean => Math.abs(scale - 1) > RESIZED_EPS;

/** The range one side may be set to, in millimetres, for showing the customer. */
export const sideRangeMm = (base: Size3, axis: keyof Size3): [number, number] => [
  base[axis] * RESIZE_MIN * 1000,
  base[axis] * RESIZE_MAX * 1000,
];
