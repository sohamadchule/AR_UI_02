import { useState } from 'react';
import type { Variant } from '@/lib/api';
import { checkFit, loadSpace, saveSpace, type Space } from '@/lib/fit';

const AXES = [
  ['width', 'Width'],
  ['depth', 'Depth'],
  ['height', 'Max height'],
] as const;

const TONE = {
  fits: 'text-emerald-700 dark:text-emerald-400',
  'fits-turned': 'text-amber-700 dark:text-amber-300',
  'too-big': 'text-red-600 dark:text-red-400',
  unknown: 'text-fg-muted',
} as const;

const HEADLINE = {
  fits: 'It fits.',
  'fits-turned': 'It fits, turned sideways.',
  'too-big': "It doesn't fit.",
  unknown: null,
} as const;

/**
 * "Will it fit?": the customer enters the space they have, and the product's real
 * size is checked against it. The product is never resized to fit; a mismatch is
 * explained in centimetres. The space is remembered on this device, so AR can
 * show it as a box in the room.
 */
export function FitCheck({ variant }: { variant: Variant }) {
  const [values, setValues] = useState(() => {
    const saved = loadSpace();
    const cm = (mm: number | null | undefined) => (mm ? String(mm / 10) : '');
    return { width: cm(saved?.width), depth: cm(saved?.depth), height: cm(saved?.height) };
  });

  const toMm = (v: string) => (Number(v) > 0 ? Number(v) * 10 : null);
  const space: Space = { width: toMm(values.width), depth: toMm(values.depth), height: toMm(values.height) };
  const entered = space.width !== null || space.depth !== null || space.height !== null;
  const result = entered ? checkFit(variant.product.dimensionsMm, space) : null;

  const update = (axis: keyof typeof values, raw: string) => {
    const next = { ...values, [axis]: raw.replace(/[^\d.]/g, '') };
    setValues(next);
    saveSpace({ width: toMm(next.width), depth: toMm(next.depth), height: toMm(next.height) });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow text-fg-subtle">Will it fit?</span>
      <p className="text-sm text-fg-muted">Enter the space you have, in cm.</p>
      <div className="grid grid-cols-3 gap-2">
        {AXES.map(([axis, label]) => (
          <label key={axis} className="flex min-w-0 flex-col gap-1 text-xs text-fg-subtle">
            {label}
            <input
              inputMode="decimal"
              value={values[axis]}
              onChange={(e) => update(axis, e.target.value)}
              placeholder="cm"
              className="h-11 w-full rounded-xl border border-line/15 bg-surface-raised px-3 text-sm text-fg placeholder:text-fg-subtle"
            />
          </label>
        ))}
      </div>
      {result && (
        <div role="status" className={`text-sm ${TONE[result.status]}`}>
          {HEADLINE[result.status] && <p className="font-semibold">{HEADLINE[result.status]}</p>}
          {result.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {result.status !== 'unknown' && (
            <p className="mt-1 text-xs text-fg-subtle">
              This is the product&apos;s real size; it is never shrunk to fit. In AR, use Add furniture → Your space to see this space in your room.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
