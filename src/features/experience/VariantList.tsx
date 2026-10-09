import type { Variant } from '@/lib/api';
import { cn } from '@/lib/cn';

interface VariantListProps {
  variants: readonly Variant[];
  activeId: string;
  onSelect: (id: string) => void;
}

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

/** Selectable list of every model in the catalog. */
export function VariantList({ variants, activeId, onSelect }: VariantListProps) {
  return (
    <div role="radiogroup" aria-label="Choose a model" className="space-y-3">
      {variants.map((v) => {
        const selected = v.id === activeId;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(v.id)}
            className={cn(
              'flex w-full items-center justify-between gap-4 rounded-2xl border p-5 text-left transition-colors duration-300',
              selected ? 'border-fg/60 bg-fg/[0.06]' : 'border-line/10 hover:border-line/30 hover:bg-fg/[0.03]',
            )}
          >
            <span className="min-w-0">
              <span className="eyebrow block text-fg-subtle">{v.category.name}</span>
              <span className="mt-1 block truncate text-lg font-light tracking-tight text-fg">{v.product.name}</span>
              <span className="block text-sm text-fg-muted">
                {v.name}
                {v.material ? ` · ${v.material}` : ''}
              </span>
            </span>
            <span className="shrink-0 text-xs text-fg-subtle">{formatSize(v.model.sizeBytes)}</span>
          </button>
        );
      })}
    </div>
  );
}
