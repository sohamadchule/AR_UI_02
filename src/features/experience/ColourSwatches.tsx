import type { Variant } from '@/lib/api';
import { cn } from '@/lib/cn';

interface ColourSwatchesProps {
  /** Every variant of one product. */
  variants: readonly Variant[];
  activeId: string;
  onSelect: (id: string) => void;
}

/** Pick a colour / finish of the current product. Variants without a colour show as a named chip. */
export function ColourSwatches({ variants, activeId, onSelect }: ColourSwatchesProps) {
  if (variants.length < 2) return null;
  const active = variants.find((v) => v.id === activeId);
  return (
    <div>
      <p className="eyebrow mb-3 text-fg-subtle">
        Colour · <span className="text-fg">{active?.name}</span>
        {active?.material ? <span className="text-fg-muted"> · {active.material}</span> : null}
      </p>
      <div role="radiogroup" aria-label="Choose a colour" className="flex flex-wrap items-center gap-3">
        {variants.map((v) => {
          const selected = v.id === activeId;
          return v.colorHex ? (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={v.name}
              title={v.name}
              onClick={() => onSelect(v.id)}
              className={cn(
                'h-9 w-9 rounded-full border border-line/20 transition-all duration-300',
                selected ? 'scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface' : 'hover:scale-105',
              )}
              style={{ backgroundColor: v.colorHex }}
            />
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
  );
}
