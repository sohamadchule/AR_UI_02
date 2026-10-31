import type { Dimensions } from '@/lib/api';

/** Axes may disagree by this much and still count as the same shape (export rounding, loose cushions). */
const TOLERANCE = 0.05;
/** Without a listed size, a file whose largest side is outside this range (metres) was exported in the wrong units. */
const PLAUSIBLE_AUTHORED: [number, number] = [0.2, 6];
/** Wrong-unit files are brought by a power of ten to near this largest side (metres). */
const TYPICAL_LARGEST = 1.2;
/** Nothing outside this (largest side, metres) is placed at all: it can't be a piece of furniture. */
const PLACEABLE: [number, number] = [0.05, 6];

/** A size in the model's own units, on glTF axes: x width, y height, z depth. */
export interface ModelSize {
  width: number;
  height: number;
  depth: number;
}

export interface TrueScale {
  /**
   * - verified: drawn at the listed size (every side within 5%).
   * - approximate: the model's shape differs from the listed size; drawn as close to it as its shape allows.
   * - no-dimensions: no size is listed; drawn at the file's size, corrected if its units were clearly wrong.
   */
  status: 'verified' | 'approximate' | 'no-dimensions';
  /** Multiply the model by this. */
  scale: number;
  /** Turn the model a quarter first: it was authored side-on. */
  swapWidthDepth: boolean;
  /** Largest disagreement between a drawn side and the listed one (0.2 = 20%). */
  deviation: number;
}

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** The single factor that best takes the model to the product's size, and how far the worst side stays off. */
function bestFactor(model: ModelSize, productMm: Dimensions): { factor: number; deviation: number } | null {
  const ratios = (['width', 'height', 'depth'] as const).flatMap((axis) => {
    const mm = productMm[axis];
    return mm !== null && model[axis] > 0 ? [mm / 1000 / model[axis]] : [];
  });
  if (!ratios.length) return null;
  const factor = median(ratios);
  return { factor, deviation: Math.max(...ratios.map((r) => Math.abs(r / factor - 1))) };
}

/**
 * How to draw a model so it occupies its product's real-world size in AR.
 *
 * The catalogue size is the source of truth, not the file: GLBs arrive in metres,
 * centimetres, millimetres or a tool's own units. When every side needs the same
 * factor the model is scaled by it (so a 200 cm sofa is drawn 2 m wide); when that
 * only holds with width and depth swapped, the model was authored side-on and is
 * turned a quarter. A model whose shape differs from the listing is still drawn at
 * the closest size its shape allows, and reported as approximate: never at the
 * file's raw size, which can be kilometres.
 */
export function resolveTrueScale(model: ModelSize, productMm: Dimensions | null): TrueScale {
  const straight = productMm && bestFactor(model, productMm);
  if (!productMm || !straight) {
    const largest = Math.max(model.width, model.height, model.depth);
    const wrongUnits = largest > 0 && (largest < PLAUSIBLE_AUTHORED[0] || largest > PLAUSIBLE_AUTHORED[1]);
    const scale = wrongUnits ? 10 ** Math.round(Math.log10(TYPICAL_LARGEST / largest)) : 1;
    return { status: 'no-dimensions', scale, swapWidthDepth: false, deviation: 0 };
  }
  const turned = bestFactor({ width: model.depth, height: model.height, depth: model.width }, productMm)!;
  const useTurned = turned.deviation < straight.deviation;
  const best = useTurned ? turned : straight;
  return {
    status: best.deviation <= TOLERANCE ? 'verified' : 'approximate',
    scale: best.factor,
    swapWidthDepth: useTurned,
    deviation: best.deviation,
  };
}

/** Whether a drawn size (metres) could be a piece of furniture at all. */
export function isPlaceable(size: ModelSize): boolean {
  const largest = Math.max(size.width, size.height, size.depth);
  return largest >= PLACEABLE[0] && largest <= PLACEABLE[1];
}
