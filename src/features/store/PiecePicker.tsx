import { useMemo, useState } from 'react';
import { Check, Palette, Search, X } from 'lucide-react';
import { tintParts } from '@/lib/color';
import { cn } from '@/lib/cn';
import { ModelThumb } from './ModelThumb';
import type { StoreProduct } from './catalog';

/** Pieces shown before "Show more": two rows on wide screens. */
const PAGE = 8;
const MIXABLE = '__mix';

/** Whether a piece has separately coloured parts that a shopper can actually change. */
export const isMixable = (p: StoreProduct) => {
  const tint = p.variants[0]?.model.tint;
  return Boolean(tint && tintParts(tint).some((part, i) => i > 0 && part.colours.length > 1));
};

/** The colours a piece offers: its main colours, then each extra part's. */
const swatchesOf = (p: StoreProduct) => {
  const tint = p.variants[0]?.model.tint;
  const extra = tint ? tintParts(tint).slice(1).flatMap((part) => part.colours.map((c) => c.hex)) : [];
  return [...new Set([...p.variants.map((v) => v.colorHex).filter((h): h is string => Boolean(h)), ...extra])];
};

function Dots({ hexes }: { hexes: string[] }) {
  if (!hexes.length) return null;
  return (
    <span className="flex items-center gap-1" aria-label={`${hexes.length} colours`}>
      <span className="flex -space-x-1" aria-hidden>
        {hexes.slice(0, 5).map((h) => (
          <i key={h} className="block h-3.5 w-3.5 rounded-full border border-surface" style={{ backgroundColor: h }} />
        ))}
      </span>
      {hexes.length > 5 && <span className="text-[11px] text-fg-subtle">+{hexes.length - 5}</span>}
    </span>
  );
}

/**
 * Step 1 of Craft: the chosen piece as one compact row, with "Change piece" opening a
 * searchable, filterable grid. Scales to a large catalogue without taking over the page.
 */
export function PiecePicker({
  products,
  selected,
  onSelect,
  initiallyOpen,
}: {
  products: readonly StoreProduct[];
  selected: StoreProduct;
  onSelect: (p: StoreProduct) => void;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE);

  // Pieces with parts to mix first (they're what Craft is for), then by name.
  const sorted = useMemo(
    () => [...products].sort((a, b) => Number(isMixable(b)) - Number(isMixable(a)) || a.name.localeCompare(b.name)),
    [products],
  );
  const categories = useMemo(() => {
    const seen = new Map<string, { slug: string; name: string; count: number }>();
    for (const p of products) {
      const c = seen.get(p.category.slug) ?? { ...p.category, count: 0 };
      c.count++;
      seen.set(c.slug, c);
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);
  const mixCount = useMemo(() => products.filter(isMixable).length, [products]);

  const q = query.trim().toLowerCase();
  const matches = sorted.filter(
    (p) =>
      (filter === 'all' || (filter === MIXABLE ? isMixable(p) : p.category.slug === filter)) &&
      (!q || `${p.name} ${p.category.name} ${p.variants.map((v) => v.name).join(' ')}`.toLowerCase().includes(q)),
  );
  const shown = matches.slice(0, limit);

  function choose(p: StoreProduct) {
    onSelect(p);
    setOpen(false);
  }

  const chip = (value: string, label: string, count: number) => (
    <button
      key={value}
      type="button"
      aria-pressed={filter === value}
      onClick={() => {
        setFilter(value);
        setLimit(PAGE);
      }}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
        filter === value ? 'border-fg bg-fg text-surface' : 'border-line/15 text-fg-muted hover:border-fg/40',
      )}
    >
      {value === MIXABLE && <Palette size={13} aria-hidden />}
      {label} <span className="opacity-60">{count}</span>
    </button>
  );

  return (
    <div>
      {/* The chosen piece. */}
      <div className="flex items-center gap-4 rounded-store border border-line/12 bg-surface-raised p-3 pr-4">
        <div className="h-16 w-20 shrink-0 bg-surface">
          <ModelThumb variant={selected.variants[0]} alt="" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{selected.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
            {selected.category.name}
            {isMixable(selected) && <span className="text-accent">Mix colours by part</span>}
            <Dots hexes={swatchesOf(selected)} />
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="shrink-0 rounded-full border border-line/20 px-4 py-2 text-sm font-medium transition-colors hover:border-fg/40"
        >
          {open ? 'Close' : `Change piece${products.length > 1 ? ` · ${products.length}` : ''}`}
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-store border border-line/12 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative block lg:w-72">
              <span className="sr-only">Search pieces</span>
              <Search size={15} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder="Search sofa, table, oak…"
                className="w-full rounded-full border border-line/15 bg-surface py-2 pl-10 pr-9 text-sm placeholder:text-fg-subtle focus:border-fg focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-fg-subtle hover:text-fg"
                >
                  <X size={14} aria-hidden />
                </button>
              )}
            </label>
            <div role="group" aria-label="Filter pieces" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:pb-0">
              {chip('all', 'All', products.length)}
              {mixCount > 0 && chip(MIXABLE, 'Mix by part', mixCount)}
              {categories.map((c) => chip(c.slug, c.name, c.count))}
            </div>
          </div>

          {matches.length === 0 ? (
            <p className="py-10 text-center text-sm text-fg-muted">
              No pieces match{q ? ` “${query.trim()}”` : ''}.{' '}
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
                className="underline underline-offset-4 hover:text-fg"
              >
                Show all
              </button>
            </p>
          ) : (
            <ul role="radiogroup" aria-label="Choose a piece" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((p) => {
                const active = p.slug === selected.slug;
                return (
                  <li key={p.slug}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => choose(p)}
                      className={cn(
                        'group relative flex h-full w-full flex-col overflow-hidden rounded-store border text-left transition-colors',
                        active ? 'border-accent ring-1 ring-accent' : 'border-line/12 hover:border-fg/35',
                      )}
                    >
                      {/* The picture is positioned inside, so a tall photo can't stretch the 4:3 box. */}
                      <div className="relative aspect-[4/3] w-full bg-surface-raised">
                        <div className="absolute inset-0">
                          <ModelThumb variant={p.variants[0]} alt="" />
                        </div>
                      </div>
                      {isMixable(p) && (
                        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent backdrop-blur">
                          <Palette size={11} aria-hidden /> Mix
                        </span>
                      )}
                      {active && (
                        <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-surface" aria-hidden>
                          <Check size={14} />
                        </span>
                      )}
                      <div className="flex flex-1 flex-col gap-1.5 p-3">
                        <span className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</span>
                        <span className="mt-auto flex items-center justify-between gap-2 text-xs text-fg-subtle">
                          <span className="truncate">{p.category.name}</span>
                          <Dots hexes={swatchesOf(p)} />
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {matches.length > limit && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE * 2)}
                className="rounded-full border border-line/20 px-5 py-2 text-sm text-fg-muted transition-colors hover:border-fg/40 hover:text-fg"
              >
                Show more · {matches.length - limit} left
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
