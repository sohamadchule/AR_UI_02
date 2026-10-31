import type { Variant } from '@/lib/api';

/** Where a product goes in a room. */
export type Placement = 'floor' | 'wall' | 'tabletop';

/** First match wins; anything unmatched stands on the floor. */
const RULES: [RegExp, Placement][] = [
  [/\b(wall (shel(f|ves)|lamps?|lights?|clocks?|art|panels?|units?)|mirrors?|paintings?|wall ?hangings?|picture frames?|sconces?|wall-mounted|clocks?)\b/, 'wall'],
  [/\b(table lamps?|desk lamps?|vases?|planters?|candles?|candle stands?|figurines?|bowls?|photo frames?|decor pieces?)\b/, 'tabletop'],
];

/** Pieces that normally stand close to bigger ones, so a narrower gap beside them is fine. */
const COMPANIONS = /\b((coffee|centre|center|side|end|console|nesting|bedside) tables?|nightstands?|ottomans?|poufs?|footstools?|lamps?)\b/;

const text = (v: Variant) => `${v.product.name} ${v.category.name}`.toLowerCase().replace(/[-_]+/g, ' ');

/**
 * Where a product is placed in AR, read from its name and category. A sofa or a
 * floor lamp stands on the floor, a mirror hangs on a wall, a table lamp sits on
 * a table (or the floor).
 */
export function placementOf(v: Variant): Placement {
  const t = text(v);
  return RULES.find(([pattern]) => pattern.test(t))?.[1] ?? 'floor';
}

export const isCompanion = (v: Variant) => COMPANIONS.test(text(v));
