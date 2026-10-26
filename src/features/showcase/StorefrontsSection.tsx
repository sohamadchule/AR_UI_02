import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { BRANDS, storePath } from '@/data/brands';
import { Reveal } from '@/components/ui/Reveal';

/**
 * The demo storefronts, each card wearing its own brand: `data-brand` swaps in that
 * client's colours and type, the same way the full store does.
 */
export function StorefrontsSection() {
  return (
    <section id="storefronts" className="bg-surface px-6 py-24 md:px-12 md:py-32">
      <Reveal className="mx-auto max-w-6xl">
        <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="eyebrow mb-6 text-fg-subtle">See it live</p>
            <h2 className="max-w-xl text-4xl font-light leading-tight tracking-tighter text-fg md:text-5xl">
              One platform.
              <span className="text-fg-subtle"> Every brand its own look.</span>
            </h2>
          </div>
          <p className="max-w-sm font-light leading-relaxed text-fg-muted">
            Three demo stores running on Akruti, each in its own colours and type. Open one and put any piece in your
            room.
          </p>
        </div>

        <ul className="grid gap-6 md:grid-cols-3">
          {BRANDS.map((brand) => (
            <li key={brand.slug}>
              <Link
                to={storePath(brand.slug)}
                data-brand={brand.slug}
                className="group flex h-full flex-col rounded-store border border-line/10 bg-surface p-7 font-body text-fg transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-product"
              >
                <span className="mb-10 flex items-center justify-between text-xs text-fg-subtle">
                  <span className="uppercase tracking-[0.16em]">{brand.city}</span>
                  <span className="rounded-full border border-line/10 px-2.5 py-1">Demo store</span>
                </span>
                <span className="store-mark mb-3 text-3xl">
                  {brand.mark[0]} <span className="text-accent">{brand.mark[1]}</span>
                </span>
                <span className="mb-8 text-sm leading-relaxed text-fg-muted">{brand.hero.lede}</span>
                <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                  Visit the store
                  <ArrowUpRight size={15} aria-hidden className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
