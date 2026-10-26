import type { Variant } from '@/lib/api';

/** Length units sizes can be entered and shown in; values are stored in mm. */
export const UNITS = {
  mm: { label: 'mm', perMm: 1, digits: 0 },
  cm: { label: 'cm', perMm: 0.1, digits: 1 },
  in: { label: 'in', perMm: 1 / 25.4, digits: 2 },
} as const;
export type Unit = keyof typeof UNITS;

/** A millimetre length expressed in `unit`, rounded for display or editing. */
export const fromMm = (mm: number, unit: Unit) => Number((mm * UNITS[unit].perMm).toFixed(UNITS[unit].digits));

/** Format a millimetre length in `unit`, e.g. (520, 'cm') → "52 cm". */
export const formatLength = (mm: number, unit: Unit) => `${fromMm(mm, unit)} ${UNITS[unit].label}`;

/**
 * The product size to show, in mm, with the unit to show it in: what the uploader
 * entered, else the model's own bounding box. Missing axes stay null.
 */
export function displayDimensions(v: Variant): { width: number | null; height: number | null; depth: number | null; unit: Unit } | null {
  const unit = v.product.dimensionUnit ?? 'mm';
  if (v.product.dimensionsMm) return { ...v.product.dimensionsMm, unit };
  const m = v.model.dimensionsM;
  return m ? { width: m.width * 1000, height: m.height * 1000, depth: m.depth * 1000, unit } : null;
}
