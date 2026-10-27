import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import { fetchVariants, viewPath, type Variant } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { usePartPicks } from '@/hooks/usePartPicks';
import { encodePicks } from '@/lib/color';
import { cn } from '@/lib/cn';
import { displayDimensions, formatLength } from '@/lib/units';
import { ModelStage } from './ModelStage';
import { QrPanel } from './QrPanel';
import { ColourSwatches } from './ColourSwatches';
import { VariantList, groupByProduct } from './VariantList';

/** True when the search text appears in the product's name, blurb, category, or any colour / material. */
function matches(group: readonly Variant[], query: string) {
  const first = group[0];
  const text = [first.product.name, first.product.blurb, first.category.name, ...group.flatMap((v) => [v.name, v.material ?? ''])];
  return text.join(' ').toLowerCase().includes(query);
}

const pill = 'flex-none whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-colors';

/**
 * The whole catalogue as a live 3D stage: pick a piece and a colour, read its real
 * size, and scan the QR to place it in AR. Shared by the Akruti experience page
 * and every client storefront's.
 *
 * Category tabs (kept in the URL as `?cat=<slug>`) and a search box narrow the list.
 */
export function ExperienceBrowser() {
  const catalog = useAsync(fetchVariants, 'variants');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { picksFor, pick } = usePartPicks();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');

  return (
    <>
      {catalog.status === 'loading' && (
        <p role="status" className="text-sm text-fg-muted">
          Loading models…
        </p>
      )}

      {catalog.status === 'error' && (
        <p role="alert" className="rounded-2xl border border-line/15 p-6 text-sm text-fg-muted">
          Couldn&apos;t load the model catalog. Make sure the API server is running (<code>npm run dev:all</code>).
        </p>
      )}

      {catalog.status === 'ready' && catalog.data.length === 0 && (
        <p className="text-sm text-fg-muted">No models are published yet.</p>
      )}

      {catalog.status === 'ready' && catalog.data.length > 0 && (() => {
        const products = groupByProduct(catalog.data);
        const defaultOf = (group: (typeof products)[number]) => group.find((v) => v.isDefault) ?? group[0];

        const categories = [...new Map(products.map((g) => [g[0].category.slug, g[0].category])).values()];
        const countOf = (slug: string) => products.filter((g) => g[0].category.slug === slug).length;
        const requested = params.get('cat');
        const cat = categories.some((c) => c.slug === requested) ? requested! : 'all';
        const inCategory = cat === 'all' ? products : products.filter((g) => g[0].category.slug === cat);
        const q = query.trim().toLowerCase();
        const shown = q ? inCategory.filter((g) => matches(g, q)) : inCategory;

        const active = catalog.data.find((v) => v.id === selectedId) ?? defaultOf(inCategory[0] ?? products[0]);
        const siblings = products.find((g) => g[0].product.id === active.product.id) ?? [active];
        const size = displayDimensions(active);
        const picks = picksFor(active.product.id);
        const mix = encodePicks(active.model.tint, picks);

        /** Switch tab, and put that category's first piece on the stage. */
        function pickCategory(slug: string) {
          setParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              if (slug === 'all') next.delete('cat');
              else next.set('cat', slug);
              return next;
            },
            { replace: true },
          );
          const first = products.find((g) => g[0].category.slug === slug);
          if (first) setSelectedId(defaultOf(first).id);
        }

        return (
          <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div role="group" aria-label="Filter by category" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {[{ slug: 'all', name: 'All' }, ...categories].map((c) => {
                  const selected = cat === c.slug;
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => pickCategory(c.slug)}
                      className={cn(pill, selected ? 'border-fg bg-fg text-surface' : 'border-line/15 text-fg-muted hover:border-fg/40')}
                    >
                      {c.name}
                      <span className={cn('ml-1.5 tabular-nums', selected ? 'opacity-70' : 'text-fg-subtle')}>
                        {c.slug === 'all' ? products.length : countOf(c.slug)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <label className="relative block md:w-64">
                <span className="sr-only">Search pieces</span>
                <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pieces"
                  className="w-full rounded-full border border-line/15 bg-transparent py-2 pl-10 pr-4 text-sm text-fg placeholder:text-fg-subtle focus:border-fg/40 focus:outline-none"
                />
              </label>
            </div>

            <div className="grid gap-10 lg:grid-cols-12">
              <div className="space-y-10 lg:col-span-7">
                <div className="space-y-5">
                  <ModelStage variant={active} picks={picks} className="h-[460px] md:h-[600px]" />
                  <ColourSwatches
                    variants={siblings}
                    activeId={active.id}
                    onSelect={setSelectedId}
                    picks={picks}
                    onPick={(part, hex) => pick(active.product.id, part, hex)}
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h2 className="text-2xl font-light tracking-tight text-fg">{active.product.name}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-fg-muted">{active.product.description}</p>
                    <Link
                      to={`${viewPath(active.id)}${mix ? `?mix=${mix}` : ''}`}
                      className="mt-4 inline-flex items-center gap-1 text-sm text-fg-soft transition-colors hover:text-fg"
                    >
                      Open public page <ArrowUpRight size={14} aria-hidden />
                    </Link>
                  </div>
                  {size && (
                    <dl className="grid grid-cols-3 gap-4 text-sm">
                      {[
                        ['Width', size.width],
                        ['Height', size.height],
                        ['Depth', size.depth],
                      ].map(([label, value]) => (
                        <div key={label as string}>
                          <dt className="eyebrow text-fg-subtle">{label}</dt>
                          <dd className="mt-1 text-fg">{value === null ? '—' : formatLength(value as number, size.unit)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>

                {/* Right under the product it encodes, not below the whole catalogue list. */}
                <div className="rounded-3xl border border-line/10 p-6">
                  <QrPanel variant={active} picks={picks} />
                </div>
              </div>

              <div className="lg:col-span-5">
                <p className="eyebrow mb-3 text-fg-subtle">
                  {shown.length} {shown.length === 1 ? 'piece' : 'pieces'}
                  {q && <span className="normal-case tracking-normal"> for “{query.trim()}”</span>}
                </p>
                {shown.length > 0 ? (
                  // Long catalogues scroll inside the column, so the stage stays in view.
                  <div className="lg:max-h-[720px] lg:overflow-y-auto lg:pr-2">
                    <VariantList
                      products={shown}
                      hideCategory={cat !== 'all'}
                      activeProductId={active.product.id}
                      onSelect={(productId) => setSelectedId(defaultOf(products.find((g) => g[0].product.id === productId)!).id)}
                    />
                  </div>
                ) : (
                  <p className="rounded-2xl border border-line/10 p-6 text-sm text-fg-muted">
                    Nothing matches. Try another word or{' '}
                    <button type="button" onClick={() => setQuery('')} className="text-fg underline underline-offset-4">
                      clear the search
                    </button>
                    .
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
