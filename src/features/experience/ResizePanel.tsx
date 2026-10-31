import { useEffect, useState } from 'react';

import { RESIZE_MAX, RESIZE_MIN, sideRangeMm } from '@/lib/resize';
import type { Dimensions } from '@/lib/api';
import type { ItemView, RoomEngine } from './roomEngine';

/**
 * Resize one placed piece.
 *
 * Proportional only: the customer sets the side they care about — the width that
 * has to clear an alcove — and the rest follows, so the piece stays the shape the
 * shop sells. Per-axis sizing is deliberately not offered; a squashed preview is
 * not the product.
 *
 * Nothing here touches the catalogue. The factor lives on this one piece, so a
 * second copy of the same product keeps its own size.
 */

const AXES = [
  { key: 'width', label: 'Width' },
  { key: 'depth', label: 'Depth' },
  { key: 'height', label: 'Height' },
] as const;

const toCm = (metres: number) => Math.round(metres * 100);
/** A catalogue side in cm, or "?" when the shop has not listed it. */
const side = (mm: number | null) => (mm === null ? '?' : Math.round(mm / 10));
const STEP_CM = 5;

export default function ResizePanel({
  item,
  engine,
}: {
  item: ItemView;
  engine: () => RoomEngine | null;
}) {
  // What the shop actually sells. Deliberately read from the catalogue and not
  // from `item.originalM`, which is the size the MODEL is drawn at: the two
  // differ whenever the model's shape does not match the listing, and quoting
  // the model's size as the shop's would state a size nobody sells.
  const listedMm: Dimensions | null = item.variant?.product.dimensionsMm ?? null;
  const listedText =
    listedMm && (listedMm.width !== null || listedMm.depth !== null || listedMm.height !== null)
      ? `${side(listedMm.width)} × ${side(listedMm.depth)} × ${side(listedMm.height)} cm`
      : null;
  // Draft text while a field is being typed in, so a half-typed "1" of "120"
  // doesn't jump the piece to 1 cm.
  const [draft, setDraft] = useState<{ axis: string; text: string } | null>(null);

  // Abandon a half-typed value if the piece changes under us.
  useEffect(() => setDraft(null), [item.id, item.userScale]);

  const percent = Math.round(item.userScale * 100);
  const resize = (scale: number) => engine()?.resizeSelected(scale);
  const commit = (axis: 'width' | 'depth' | 'height', text: string) => {
    const cm = Number.parseFloat(text);
    if (Number.isFinite(cm) && cm > 0) engine()?.resizeSelectedToMm(axis, cm * 10);
    setDraft(null);
  };

  const [minMm, maxMm] = sideRangeMm(item.originalM, 'width');
  const minCm = Math.round(minMm / 10);
  const maxCm = Math.round(maxMm / 10);
  const atLimit = percent <= RESIZE_MIN * 100 ? 'smallest' : percent >= RESIZE_MAX * 100 ? 'largest' : null;

  return (
    <div className="mt-3 rounded-xl bg-white/10 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold">Resize</p>
        <p className="text-xs tabular-nums text-white/70">{percent}% of the listed size</p>
      </div>

      {/* Type a side; the others follow so the shape is kept. */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {AXES.map(({ key, label }) => {
          const shown = draft?.axis === key ? draft.text : String(toCm(item.sizeM[key]));
          return (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-white/50">{label}</span>
              <span className="flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1.5">
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={shown}
                  onChange={(e) => setDraft({ axis: key, text: e.target.value })}
                  onBlur={(e) => (draft?.axis === key ? commit(key, e.target.value) : setDraft(null))}
                  onKeyDown={(e) => e.key === 'Enter' && commit(key, (e.target as HTMLInputElement).value)}
                  className="w-full bg-transparent text-sm tabular-nums outline-none"
                  aria-label={`${label} in centimetres`}
                />
                <span className="text-[10px] text-white/50">cm</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          aria-label={`Narrower by ${STEP_CM} centimetres`}
          onClick={() => engine()?.resizeSelectedToMm('width', (toCm(item.sizeM.width) - STEP_CM) * 10)}
          className="h-8 w-8 shrink-0 rounded-full bg-white/15 text-sm font-semibold"
        >
          −
        </button>
        <input
          type="range"
          min={RESIZE_MIN * 100}
          max={RESIZE_MAX * 100}
          step={1}
          value={percent}
          onChange={(e) => resize(Number(e.target.value) / 100)}
          className="min-w-0 flex-1 accent-white"
          aria-label="Size, as a percentage of the listed size"
        />
        <button
          type="button"
          aria-label={`Wider by ${STEP_CM} centimetres`}
          onClick={() => engine()?.resizeSelectedToMm('width', (toCm(item.sizeM.width) + STEP_CM) * 10)}
          className="h-8 w-8 shrink-0 rounded-full bg-white/15 text-sm font-semibold"
        >
          +
        </button>
      </div>
      <p className="mt-1 text-[10px] text-white/40">
        Width can go from {minCm} to {maxCm} cm. Depth and height follow, so the piece keeps its shape.
      </p>
      {/* Say so when a request was limited, rather than silently showing a different number. */}
      {atLimit && <p className="mt-1 text-[10px] font-medium text-amber-300">This is the {atLimit} size this preview offers.</p>}

      {item.resized && (
        <>
          <button type="button" onClick={() => engine()?.resetSelectedSize()} className="mt-3 w-full rounded-full bg-white/15 px-4 py-2 text-xs font-medium">
            Reset to the original size ({toCm(item.originalM.width)} × {toCm(item.originalM.depth)} ×{' '}
            {toCm(item.originalM.height)} cm)
          </button>
          {/* The customer is now looking at something the shop may not sell. */}
          <p className="mt-2 rounded-lg bg-amber-500/90 px-3 py-2 text-[11px] font-medium leading-snug text-black">
            This is a resized preview, not the product.{' '}
            {listedText ? `The shop lists this piece at ${listedText}.` : "The shop has not listed this piece's size."}{' '}
            Ask whether they can make it at your size before ordering. The resized view lives only in this AR
            session — it is not saved and is not what the shop will send.
          </p>
        </>
      )}
    </div>
  );
}
