import type { Swatch } from '@/data/content';
import { cn } from '@/lib/cn';

interface SwatchPickerProps {
  swatches: readonly Swatch[];
  activeId: string;
  onChange: (id: string) => void;
}

export function SwatchPicker({ swatches, activeId, onChange }: SwatchPickerProps) {
  return (
    <div role="radiogroup" aria-label="Select material" className="space-y-4">
      <p className="text-sm font-medium uppercase tracking-wider text-fg-soft">Select Color</p>
      <div className="flex gap-4">
        {swatches.map((swatch) => {
          const selected = swatch.id === activeId;
          return (
            <button
              key={swatch.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={swatch.name}
              onClick={() => onChange(swatch.id)}
              className="flex flex-col items-center gap-2"
            >
              <span
                className={cn(
                  'h-10 w-10 rounded-full transition-all duration-300',
                  selected
                    ? 'scale-110 ring-2 ring-fg ring-offset-2 ring-offset-surface-raised'
                    : 'opacity-70 hover:opacity-100',
                )}
                style={{ backgroundColor: swatch.hex }}
              />
              <span className={cn('text-[10px] uppercase tracking-wider', selected ? 'text-fg' : 'text-fg-subtle')}>
                {swatch.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
