import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import type { Brand } from '@/data/brands';
import { storeProductPath } from '@/data/brands';
import { useAsync } from '@/hooks/useAsync';
import { ModelThumb } from '@/features/store/ModelThumb';
import { ShopEntrance } from '@/features/store/ShopEntrance';
import { showroomBySlug } from '@/data/showrooms';
import { ShowroomHomePage } from './ShowroomHomePage';
import { VisualiseSection } from '@/features/store/flagship/VisualiseSection';
import { ProcessSection } from '@/features/store/flagship/ProcessSection';
import { CraftSection } from '@/features/store/flagship/CraftSection';
import { ReviewsSection } from '@/features/store/flagship/ReviewsSection';
import { VisitSection } from '@/features/store/flagship/VisitSection';
import {
  curate,
  defaultVariant,
  discountPercent,
  formatInr,
  loadCatalogue,
  type StoreProduct,
} from '@/features/store/catalog';

function PriceLine({ product }: { product: StoreProduct }) {
  if (product.priceInr === null) return <span className="text-sm text-fg-muted">Price on request</span>;
  const off = discountPercent(product);
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-semibold tabular-nums">{formatInr(product.priceInr)}</span>
      {off !== null && product.mrpInr !== null && (
        <span className="text-xs tabular-nums text-fg-subtle line-through">{formatInr(product.mrpInr)}</span>
      )}
    </span>
  );
}

function ProductTile({ brand, product }: { brand: Brand; product: StoreProduct }) {
  const variant = defaultVariant(product);
  const swatches = variant
    ? product.variants.map((v) => ({ name: v.name, hex: v.colorHex }))
    : product.sampleFinishes.map((f) => ({ name: f.name, hex: f.hex }));

  return (
    <Link
      to={storeProductPath(brand.slug, product.slug)}
      className="group flex flex-col overflow-hidden rounded-store border border-line/12 bg-surface transition-colors hover:border-accent/45"
    >
      <div className="relative grid aspect-[10/9] place-items-center bg-surface-sunken p-3">
        {product.variants.length > 1 && (
          <span className="absolute left-2.5 top-2.5 rounded-full border border-line/15 bg-surface/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            {product.variants.length} finishes
          </span>
        )}
        <ModelThumb variant={variant} alt={product.name} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3.5">
        <span className="font-semibold">{product.name}</span>
        {product.blurb && <span className="text-xs text-fg-subtle">{product.blurb}</span>}
        <div className="mt-2 flex items-center justify-between gap-3">
          <PriceLine product={product} />
          <span className="flex gap-1">
            {swatches.slice(0, 4).map((s, i) => (
              <i
                key={i}
                title={s.name}
                className="h-3 w-3 rounded-full border border-fg/15"
                style={s.hex ? { backgroundColor: s.hex } : undefined}
              />
            ))}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function StoreHomePage() {
  const brand = useOutletContext<Brand>();
  const [params, setParams] = useSearchParams();
  const room = params.get('room') ?? 'all';
  const catalogue = useAsync(loadCatalogue, 'store-catalogue');

  // A shop with an immersive showroom site (src/data/showrooms.ts) gets that home page instead.
  const showroom = showroomBySlug(brand.slug);
  if (showroom) {
    return <ShowroomHomePage brand={brand} showroom={showroom} catalogue={catalogue.status === 'ready' ? catalogue.data : null} />;
  }

  // A flagship shop shows its own curated collection, in its own order.
  const { flagship } = brand;
  const products = catalogue.status === 'ready' ? curate(catalogue.data.products, flagship) : [];
  const categories = catalogue.status === 'ready' ? catalogue.data.categories.filter((c) => products.some((p) => p.category.slug === c.slug)) : [];
  const featured = flagship && products.find((p) => p.slug === flagship.featured);
  const shown = room === 'all' ? products : products.filter((p) => p.category.slug === room);
  const rooms = categories.map((c) => ({ ...c, count: products.filter((p) => p.category.slug === c.slug).length }));

  /** From the showroom: filter the catalogue to one room (or all) and walk over to it. */
  function openRoom(slug: string) {
    setParams(slug === 'all' ? {} : { room: slug }, { replace: true });
    document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <>
      <ShopEntrance brand={brand} rooms={rooms} onRoom={openRoom} />
      {featured && <VisualiseSection brand={brand} product={featured} />}
      {flagship && <ProcessSection steps={flagship.process} />}

      <section id="catalogue" className="mx-auto w-full max-w-[1180px] scroll-mt-16 px-4 py-10 sm:px-6 md:py-14">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-fg-subtle">{brand.catalogue.eyebrow}</p>
            <h2 className="mt-2 font-display text-[clamp(1.5rem,3vw,2.1rem)] tracking-tight">{brand.catalogue.title}</h2>
          </div>
          <p className="text-sm text-fg-subtle">Tap any piece to open its product page</p>
        </div>

        {catalogue.status === 'ready' && catalogue.data.isSample && (
          <p role="status" className="mb-5 rounded-store border border-line/15 bg-surface-raised px-4 py-3 text-sm text-fg-muted">
            Showing the bundled sample catalogue — no products are active in the database yet. Run{' '}
            <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs">npm run db:seed:store</code> to load the real models.
          </p>
        )}

        <div role="group" aria-label="Filter by room" className="flex gap-2 overflow-x-auto pb-1">
          {[{ slug: 'all', name: 'All' }, ...categories].map((c) => (
            <button
              key={c.slug}
              type="button"
              aria-pressed={room === c.slug}
              onClick={() => setParams(c.slug === 'all' ? {} : { room: c.slug }, { replace: true })}
              className={
                room === c.slug
                  ? 'flex-none whitespace-nowrap rounded-full border border-fg bg-fg px-4 py-1.5 text-sm text-surface'
                  : 'flex-none whitespace-nowrap rounded-full border border-line/15 px-4 py-1.5 text-sm text-fg-muted transition-colors hover:border-fg/40'
              }
            >
              {c.name}
            </button>
          ))}
        </div>

        {catalogue.status === 'loading' && (
          <p role="status" className="py-16 text-center text-sm text-fg-muted">Loading the catalogue…</p>
        )}

        {catalogue.status === 'ready' && (
          <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(215px,1fr))] gap-4">
            {shown.map((p) => (
              <ProductTile key={p.slug} brand={brand} product={p} />
            ))}
          </div>
        )}

        {catalogue.status === 'ready' && shown.length === 0 && (
          <p className="py-14 text-center text-sm text-fg-muted">Nothing in this room yet.</p>
        )}
      </section>
      {flagship && (
        <>
          <CraftSection brand={brand} materials={flagship.materials} />
          <ReviewsSection reviews={flagship.reviews} />
          <VisitSection brand={brand} pieces={products.map((p) => p.name)} />
        </>
      )}
    </>
  );
}
