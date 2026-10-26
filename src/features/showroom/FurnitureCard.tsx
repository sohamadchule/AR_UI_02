import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Box, ScanLine } from 'lucide-react';
import { storeProductPath, type Brand } from '@/data/brands';
import { productImage, type Showroom } from '@/data/showrooms';
import { viewPath } from '@/lib/api';
import { ModelThumb } from '@/features/store/ModelThumb';
import { formatInr, type StoreProduct } from '@/features/store/catalog';
import { isArDevice } from './scroll';
import type { ViewerMode } from './ViewerDialog';
import { cn } from '@/lib/cn';

/** The product's picture: the still rendered from its own 3D model, or the drawn tile if there is none yet. */
export function ProductPicture({ showroom, product, className }: { showroom: Showroom; product: StoreProduct; className?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return <ModelThumb variant={product.variants[0]} alt={product.name} />;
  return (
    <img
      src={productImage(showroom, product.slug)}
      alt={product.name}
      loading="lazy"
      decoding="async"
      onError={() => setMissing(true)}
      className={cn('h-full w-full object-contain', className)}
    />
  );
}

export function FurnitureCard({
  brand,
  showroom,
  product,
  large = false,
  onView,
}: {
  brand: Brand;
  showroom: Showroom;
  product: StoreProduct;
  large?: boolean;
  onView: (product: StoreProduct, mode: ViewerMode) => void;
}) {
  const variant = product.variants[0];
  const href = storeProductPath(brand.slug, product.slug);
  // Sample rows (no database yet) have no model: no 3D or AR buttons for them.
  const has3d = Boolean(variant);
  const colours = product.variants.filter((v) => v.colorHex);
  const action = 'inline-flex items-center gap-1.5 text-[13px] transition-colors';

  return (
    <article className="group flex h-full flex-col">
      <Link to={href} className="relative block overflow-hidden bg-surface-sunken" aria-label={`${product.name}, ${product.category.name}`}>
        <div className={cn('relative', large ? 'aspect-[4/3]' : 'aspect-[5/4]')}>
          {/* A soft floor shadow and warm light, like a piece on the showroom floor. */}
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_45%,rgb(var(--surface)/0.9),transparent_75%)]" />
          <div className="absolute inset-[8%] transition-transform duration-[900ms] ease-out-expo group-hover:-translate-y-1.5 group-hover:scale-[1.04]">
            <ProductPicture showroom={showroom} product={product} />
          </div>
          <span className="absolute left-4 top-4 text-[10px] uppercase tracking-[0.26em] text-fg-muted">{product.category.name}</span>
          {colours.length > 1 && (
            <span className="absolute right-4 top-4 flex gap-1" aria-label={`${colours.length} colours`}>
              {colours.slice(0, 5).map((v) => (
                <i key={v.id} title={v.name} className="h-2.5 w-2.5 rounded-full border border-fg/15" style={{ backgroundColor: v.colorHex! }} />
              ))}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col pt-5">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className={cn('font-display leading-tight transition-colors duration-500 group-hover:text-accent', large ? 'text-3xl md:text-4xl' : 'text-2xl')}>
            <Link to={href}>{product.name}</Link>
          </h3>
          {product.priceInr !== null && (
            <span className="shrink-0 text-sm tabular-nums text-fg-muted">
              <span className="text-fg-subtle">From </span>
              {formatInr(product.priceInr)}
            </span>
          )}
        </div>
        {(product.blurb || product.description) && (
          <p className="mt-2 line-clamp-2 max-w-[52ch] text-sm leading-relaxed text-fg-muted">{product.blurb || product.description}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line/10 pt-4">
          <Link to={href} className={cn(action, 'font-medium text-fg hover:text-accent')}>
            Explore product <ArrowUpRight size={14} aria-hidden />
          </Link>
          {has3d && (
            <button type="button" onClick={() => onView(product, '3d')} className={cn(action, 'text-fg-muted hover:text-fg')}>
              <Box size={14} aria-hidden /> View in 3D
            </button>
          )}
          {has3d &&
            (isArDevice() ? (
              // On a phone, straight to the AR page for this piece.
              <Link to={viewPath(variant.id)} className={cn(action, 'text-fg-muted hover:text-fg')}>
                <ScanLine size={14} aria-hidden /> View in your room
              </Link>
            ) : (
              <button type="button" onClick={() => onView(product, 'room')} className={cn(action, 'text-fg-muted hover:text-fg')}>
                <ScanLine size={14} aria-hidden /> View in your room
              </button>
            ))}
        </div>
      </div>
    </article>
  );
}
