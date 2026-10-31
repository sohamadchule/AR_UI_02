import type { Dimensions } from '@/lib/api';

/** The customer's available space, in mm; any side may be left out. */
export type Space = Dimensions;

export type FitStatus = 'fits' | 'fits-turned' | 'too-big' | 'unknown';

export interface FitResult {
  status: FitStatus;
  /** Plain-language reasons, one per line. */
  lines: string[];
}

const AXES = [
  ['width', 'wide', 'width'],
  ['depth', 'deep', 'depth'],
  ['height', 'tall', 'height'],
] as const;

const cm = (mm: number) => Math.max(1, Math.round(mm / 10));
const known = (d: Dimensions | null) => Boolean(d && (d.width !== null || d.depth !== null || d.height !== null));

/** How much each side of `product` exceeds `space` (positive) or leaves spare (negative), where both are known. */
function differences(product: Dimensions, space: Space) {
  return AXES.flatMap(([axis, adjective, noun]) => {
    const p = product[axis];
    const s = space[axis];
    return p === null || s === null ? [] : [{ axis, adjective, noun, over: p - s }];
  });
}

/**
 * Whether a fixed-size product fits the customer's space, and why not.
 *
 * The product is never resized to make it fit: a 200 cm sofa in a 180 cm space
 * is reported as 20 cm too wide. Turning it sideways (width along the space's
 * depth) is offered when only that orientation fits.
 */
export function checkFit(product: Dimensions | null, space: Space): FitResult {
  if (!product || !known(product)) return { status: 'unknown', lines: ["This product's size isn't listed, so we can't check it."] };
  if (!known(space)) return { status: 'unknown', lines: ['Enter at least one measurement of your space.'] };

  const straight = differences(product, space);
  if (!straight.length) return { status: 'unknown', lines: ["Your measurements don't cover any side this product lists."] };
  if (straight.every((d) => d.over <= 0)) {
    return {
      status: 'fits',
      lines: straight.map((d) => (d.over === 0 ? `Exactly fills the ${d.noun}.` : `${cm(-d.over)} cm to spare in ${d.noun}.`)),
    };
  }

  const turned = differences({ width: product.depth, depth: product.width, height: product.height }, space);
  if (product.width !== null && product.depth !== null && turned.length && turned.every((d) => d.over <= 0)) {
    return {
      status: 'fits-turned',
      lines: [`Fits only if turned sideways: its ${cm(product.depth)} cm depth along your ${cm(space.width ?? 0)} cm width.`],
    };
  }

  return {
    status: 'too-big',
    lines: straight.filter((d) => d.over > 0).map((d) => `${cm(d.over)} cm too ${d.adjective}.`),
  };
}

const SPACE_KEY = 'akruti.space';

/** The space the customer last entered on this device, if any. */
export function loadSpace(): Space | null {
  try {
    const raw = localStorage.getItem(SPACE_KEY);
    const v = raw ? (JSON.parse(raw) as Space) : null;
    return v && known(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveSpace(space: Space) {
  try {
    localStorage.setItem(SPACE_KEY, JSON.stringify(space));
  } catch {
    // Storage blocked (private mode): the check still works, it just isn't remembered.
  }
}
