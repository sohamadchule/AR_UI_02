import type { Variant } from '@/lib/api';
import { tintParts, type PartPicks } from '@/lib/color';
import { cn } from '@/lib/cn';

interface ColourSwatchesProps {
  /** Every variant of one product. */
  variants: readonly Variant[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Colours picked for the product's extra parts, and how to change one (see usePartPicks). Without them only the main colour is offered. */
  picks?: PartPicks;
  onPick?: (part: number, hex: string) => void;
  className?: string;
}

function Swatch({ hex, label, selected, onClick }: { hex: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'h-9 w-9 rounded-full border border-line/20 transition-all duration-300',
        selected ? 'scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface' : 'hover:scale-105',
      )}
      style={{ backgroundColor: hex }}
    />
  );
}

/**
 * Pick a colour / finish of the current product. Variants without a colour show as a named chip.
 * A product made of separately coloured parts gets one row per part, each remembered on its own.
 */
export function ColourSwatches({ variants, activeId, onSelect, picks = {}, onPick, className }: ColourSwatchesProps) {
  const active = variants.find((v) => v.id === activeId);
  const parts = active?.model.tint ? tintParts(active.model.tint) : [];
  const multi = parts.length > 1 && onPick !== undefined;
  if (variants.length < 2 && !multi) return null;
  return (
    <div className={cn('space-y-5', className)}>
      {variants.length > 1 && (
        <div>
          <p className="eyebrow mb-3 text-fg-subtle">
            {multi ? parts[0].name : 'Colour'} · <span className="text-fg">{active?.name}</span>
            {active?.material ? <span className="text-fg-muted"> · {active.material}</span> : null}
          </p>
          <div role="radiogroup" aria-label={multi ? `Choose a colour for ${parts[0].name}` : 'Choose a colour'} className="flex flex-wrap items-center gap-3">
            {variants.map((v) => {
              const selected = v.id === activeId;
              return v.colorHex ? (
                <Swatch key={v.id} hex={v.colorHex} label={v.name} selected={selected} onClick={() => onSelect(v.id)} />
              ) : (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelect(v.id)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-xs uppercase tracking-[0.12em] transition-colors',
                    selected ? 'border-fg bg-fg text-surface' : 'border-line/20 text-fg-muted hover:border-fg',
                  )}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {multi && active && <PartColourRows variant={active} picks={picks} onPick={onPick} />}
    </div>
  );
}

/** One swatch row per extra part of `variant`'s model (nothing for single-part models). */
export function PartColourRows({
  variant,
  picks,
  onPick,
  className,
}: {
  variant: Variant;
  picks: PartPicks;
  onPick: (part: number, hex: string) => void;
  className?: string;
}) {
  const parts = variant.model.tint ? tintParts(variant.model.tint) : [];
  if (parts.length < 2) return null;
  const chosen = (i: number) => picks[i] ?? parts[i].colours[0]?.hex;
  const changed = parts.some((p, i) => i > 0 && chosen(i) !== p.colours[0]?.hex);
  return (
    <div className={cn('space-y-5', className)}>
      {parts.map((part, i) => {
        // One colour is nothing to choose between.
        if (i === 0 || part.colours.length < 2) return null;
        const current = part.colours.find((c) => c.hex === chosen(i)) ?? part.colours[0];
        return (
          <div key={part.name}>
            <p className="eyebrow mb-3 text-fg-subtle">
              {part.name} · <span className="text-fg">{current.name}</span>
            </p>
            <div role="radiogroup" aria-label={`Choose a colour for ${part.name}`} className="flex flex-wrap items-center gap-3">
              {part.colours.map((c) => (
                <Swatch key={c.hex} hex={c.hex} label={`${part.name}: ${c.name}`} selected={c.hex === current.hex} onClick={() => onPick(i, c.hex)} />
              ))}
            </div>
          </div>
        );
      })}
      {changed && (
        <button
          type="button"
          onClick={() => parts.forEach((p, i) => i > 0 && p.colours[0] && onPick(i, p.colours[0].hex))}
          className="text-xs text-fg-muted underline underline-offset-4 hover:text-fg"
        >
          Reset {parts.length > 2 ? 'part colours' : `${parts[1].name.toLowerCase()} colour`}
        </button>
      )}
    </div>
  );
}
