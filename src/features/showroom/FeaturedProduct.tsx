import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ScanLine } from 'lucide-react';
import { storeProductPath, type Brand } from '@/data/brands';
import { SECTION, type Showroom } from '@/data/showrooms';
import { viewPath } from '@/lib/api';
import { recolorOf } from '@/lib/color';
import ProductArExperience from '@/features/experience/ProductArExperience';
import { ColourSwatches } from '@/features/experience/ColourSwatches';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { usePartPicks } from '@/hooks/usePartPicks';
import { Reveal } from '@/components/ui/Reveal';
import { dimensionsCm, formatInr, type StoreProduct } from '@/features/store/catalog';
import { ProductPicture } from './FurnitureCard';
import { ViewerDialog } from './ViewerDialog';
import { isArDevice, useNearViewport } from './scroll';

/**
 * One piece, up close: its live 3D model on one side, its real details on the other.
 * Everything shown comes from the catalogue (size, colours, material, price); nothing
 * is written in by hand. The 3D view only loads once the section is near the screen.
 */
export function FeaturedProduct({ brand, showroom, product }: { brand: Brand; showroom: Showroom; product: StoreProduct }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? '');
  const { picksFor, pick } = usePartPicks();
  const picks = picksFor(product.slug);
  const [qrOpen, setQrOpen] = useState(false);
  const { ref, near } = useNearViewport<HTMLDivElement>('400px');
  const stageRef = useRef<HTMLDivElement>(null);
  const [modelReady, setModelReady] = useState(false);

  // <model-viewer> fires a non-bubbling `load`; a capturing listener on the wrapper still hears it.
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const onLoad = (e: Event) => {
      if ((e.target as Element).tagName === 'MODEL-VIEWER') setModelReady(true);
    };
    node.addEventListener('load', onLoad, true);
    return () => node.removeEventListener('load', onLoad, true);
  }, [near]);
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const dims = dimensionsCm(product, variant);
  if (!variant) return null;

  const facts: [string, string][] = [
    ...(dims
      ? ([
          ['Width', `${Math.round(dims.width)} cm`],
          ['Depth', `${Math.round(dims.depth)} cm`],
          ['Height', `${Math.round(dims.height)} cm`],
        ] as [string, string][])
      : []),
    ...(variant.material ? ([['Material', variant.material]] as [string, string][]) : []),
  ];

  return (
    <section id={SECTION.featured} aria-labelledby="featured-title" className="scroll-mt-16 bg-surface-raised py-24 md:py-32">
      <div className="mx-auto grid w-full max-w-[1280px] gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:items-center lg:gap-16">
        <div ref={ref} className="relative aspect-[4/3] overflow-hidden bg-surface-sunken lg:col-span-7">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(65%_55%_at_50%_45%,rgb(var(--surface)/0.85),transparent_75%)]" />
          {/* The rendered still holds the space until the live model is ready. */}
          <div className="absolute inset-[10%] transition-opacity duration-700" style={{ opacity: modelReady ? 0 : 1 }}>
            <ProductPicture showroom={showroom} product={product} />
          </div>
          {near && (
            <ErrorBoundary resetKey={variant.model.url} fallback={null}>
              <div
                ref={stageRef}
                // Transparent until the model has loaded, so the still shows instead of a spinner.
                className="absolute inset-0 transition-opacity duration-700"
                style={{ opacity: modelReady ? 1 : 0 }}
              >
                <ProductArExperience
                  src={variant.model.url}
                  alt={`3D model of the ${product.name} in ${variant.name}`}
                  recolor={recolorOf(variant, picks)}
                  autoRotate
                  disableZoom
                  showArUnavailable={false}
                  cameraOrbit={showroom.featured.cameraOrbit}
                />
              </div>
            </ErrorBoundary>
          )}
          <p className="pointer-events-none absolute bottom-4 left-5 text-[10px] uppercase tracking-[0.26em] text-fg-subtle">Drag to rotate</p>
        </div>

        <Reveal className="lg:col-span-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-olive">{showroom.featured.eyebrow}</p>
          <h2 id="featured-title" className="mt-5 font-display text-[clamp(2.4rem,4.6vw,4rem)] leading-[1.02]">
            {product.name}
          </h2>
          {product.description && <p className="mt-5 max-w-[46ch] leading-relaxed text-fg-muted">{product.description}</p>}

          {facts.length > 0 && (
            <dl className="mt-9 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-line/10 pt-6 sm:grid-cols-4">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-[0.24em] text-fg-subtle">{k}</dt>
                  <dd className="mt-1.5 text-lg tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <ColourSwatches
            className="mt-8"
            variants={product.variants}
            activeId={variant.id}
            onSelect={setVariantId}
            picks={picks}
            onPick={(part, hex) => pick(product.slug, part, hex)}
          />

          {product.priceInr !== null && (
            <p className="mt-8 font-display text-3xl tabular-nums">
              {formatInr(product.priceInr)}
              {product.mrpInr !== null && product.mrpInr > product.priceInr && (
                <span className="ml-3 font-body text-base text-fg-subtle line-through">{formatInr(product.mrpInr)}</span>
              )}
            </p>
          )}

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to={storeProductPath(brand.slug, product.slug)}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-fg px-7 text-sm font-medium text-surface transition-opacity hover:opacity-90"
            >
              Explore in 3D <ArrowUpRight size={16} aria-hidden />
            </Link>
            {isArDevice() ? (
              <Link
                to={viewPath(variant.id)}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-line/25 px-7 text-sm font-medium transition-colors hover:border-fg/60"
              >
                <ScanLine size={16} aria-hidden /> View in Your Room
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-line/25 px-7 text-sm font-medium transition-colors hover:border-fg/60"
              >
                <ScanLine size={16} aria-hidden /> View in Your Room
              </button>
            )}
          </div>
        </Reveal>
      </div>

      {qrOpen && (
        <ViewerDialog brand={brand} product={product} mode="room" initialVariantId={variant.id} initialPicks={picks} onClose={() => setQrOpen(false)} />
      )}
    </section>
  );
}
