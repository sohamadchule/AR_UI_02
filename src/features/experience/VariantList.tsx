import type { Variant } from '@/lib/api';
import { cn } from '@/lib/cn';

interface VariantListProps {
  /** Variants grouped by product (see `groupByProduct`). */
  products: readonly (readonly Variant[])[];
  activeProductId: string;
  onSelect: (productId: string) => void;
  /** Hide the category label on each row, e.g. when the list is already filtered to one category. */
  hideCategory?: boolean;
}

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

/** Variants grouped by product, in catalogue order. */
export function groupByProduct(variants: readonly Variant[]): Variant[][] {
  const groups = new Map<string, Variant[]>();
  for (const v of variants) groups.set(v.product.id, [...(groups.get(v.product.id) ?? []), v]);
  return [...groups.values()];
}

/** Selectable list of every product in the catalog, with a preview of its colours. */
export function VariantList({ products, activeProductId, onSelect, hideCategory = false }: VariantListProps) {
  return (
    <div role="radiogroup" aria-label="Choose a model" className="space-y-3">
      {products.map((variants) => {
        const first = variants.find((v) => v.isDefault) ?? variants[0];
        const selected = first.product.id === activeProductId;
        const colours = variants.filter((v) => v.colorHex);
        return (
          <button
            key={first.product.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(first.product.id)}
            className={cn(
              'flex w-full items-center justify-between gap-4 rounded-2xl border p-5 text-left transition-colors duration-300',
              selected ? 'border-fg/60 bg-fg/[0.06]' : 'border-line/10 hover:border-line/30 hover:bg-fg/[0.03]',
            )}
          >
            <span className="min-w-0">
              {!hideCategory && <span className="eyebrow block text-fg-subtle">{first.category.name}</span>}
              <span className={cn('block truncate text-lg font-light tracking-tight text-fg', !hideCategory && 'mt-1')}>{first.product.name}</span>
              <span className="mt-1 flex items-center gap-2 text-sm text-fg-muted">
                {colours.length > 0 && (
                  <span aria-hidden className="flex -space-x-1">
                    {colours.slice(0, 6).map((v) => (
                      <span key={v.id} className="h-3.5 w-3.5 rounded-full border border-surface" style={{ backgroundColor: v.colorHex! }} />
                    ))}
                  </span>
                )}
                {variants.length > 1 ? `${variants.length} options` : `${first.name}${first.material ? ` · ${first.material}` : ''}`}
              </span>
            </span>
            <span className="shrink-0 text-xs text-fg-subtle">{formatSize(first.model.sizeBytes)}</span>
          </button>
        );
      })}
    </div>
  );
}
