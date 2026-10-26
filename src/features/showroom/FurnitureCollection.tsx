import { useState } from 'react';
import type { Brand } from '@/data/brands';
import { SECTION, type Showroom } from '@/data/showrooms';
import type { StoreCatalogue, StoreProduct } from '@/features/store/catalog';
import { Reveal } from '@/components/ui/Reveal';
import { FurnitureCard } from './FurnitureCard';
import { ViewerDialog, type ViewerMode } from './ViewerDialog';
import { cn } from '@/lib/cn';

/*
 * Editorial rhythm on wide screens: a large piece beside a medium one, then a row of
 * three. Columns out of 12, repeating every five pieces.
 */
const SPANS = ['lg:col-span-7', 'lg:col-span-5', 'lg:col-span-4', 'lg:col-span-4', 'lg:col-span-4'];

export function FurnitureCollection({
  brand,
  showroom,
  catalogue,
}: {
  brand: Brand;
  showroom: Showroom;
  catalogue: StoreCatalogue | null;
}) {
  const { collection } = showroom;
  const [category, setCategory] = useState('all');
  const [viewing, setViewing] = useState<{ product: StoreProduct; mode: ViewerMode } | null>(null);

  const products = catalogue?.products ?? [];
  const shown = category === 'all' ? products : products.filter((p) => p.category.slug === category);

  return (
    <section id={SECTION.collection} aria-labelledby="collection-title" className="scroll-mt-16 bg-surface pb-28 pt-20 md:pb-36 md:pt-28">
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8">
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <Reveal className="md:col-span-7">
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-olive">{collection.eyebrow}</p>
            <h2 id="collection-title" className="mt-5 font-display text-[clamp(2.5rem,5.6vw,4.8rem)] leading-[1] tracking-[-0.01em]">
              {collection.title[0]}
              <br />
              <em className="text-fg-muted">{collection.title[1]}</em>
            </h2>
          </Reveal>
          <Reveal className="md:col-span-5">
            <p className="max-w-[42ch] leading-relaxed text-fg-muted md:text-lg">{collection.lede}</p>
          </Reveal>
        </div>

        {catalogue?.isSample && (
          <p role="status" className="mt-10 border border-dashed border-line/25 px-4 py-3 text-sm text-fg-muted">
            Showing sample pieces: the catalogue database is empty, so these have no 3D model yet.
          </p>
        )}

        {catalogue && catalogue.categories.length > 1 && (
          <div role="group" aria-label="Filter by category" className="-mx-1 mt-14 flex gap-1 overflow-x-auto px-1 pb-1">
            {[{ slug: 'all', name: 'All pieces' }, ...catalogue.categories].map((c) => {
              const active = category === c.slug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(c.slug)}
                  className={cn(
                    'flex-none whitespace-nowrap border-b px-3 py-2 text-sm transition-colors duration-300',
                    active ? 'border-fg text-fg' : 'border-transparent text-fg-subtle hover:text-fg',
                  )}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        {!catalogue && (
          <p role="status" className="mt-14 text-sm text-fg-muted">
            Loading the collection…
          </p>
        )}

        <div className="mt-10 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-12">
          {shown.map((product, i) => (
            <Reveal key={product.slug} className={cn(SPANS[i % SPANS.length])}>
              <FurnitureCard
                brand={brand}
                showroom={showroom}
                product={product}
                large={i % SPANS.length === 0}
                onView={(p, mode) => setViewing({ product: p, mode })}
              />
            </Reveal>
          ))}
        </div>
      </div>

      {viewing && <ViewerDialog brand={brand} product={viewing.product} mode={viewing.mode} onClose={() => setViewing(null)} />}
    </section>
  );
}
