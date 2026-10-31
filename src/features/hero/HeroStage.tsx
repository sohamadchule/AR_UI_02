import { IMAGES } from '@/data/content';
import { fetchVariants, type Variant } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { recolorOf } from '@/lib/color';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import ProductArExperience from '@/features/experience/ProductArExperience';

/** The catalogue piece the hero shows off; any multi-colour product is the fallback. */
const HERO_PRODUCT = 'mahal-3-seater-sofa';
/** Opening colour: the soft blue reads well against the dark stage. */
const HERO_COLOUR = 'Powder Blue';
/** Start (and reset) on a three-quarter view of the Mahal's front; auto-rotate turns it from there. */
const HERO_ORBIT = '20deg 75deg 105%';

/** Every variant of the hero product, opening colour first, or null when the catalogue has nothing usable. */
function heroVariants(all: readonly Variant[]): Variant[] | null {
  const byProduct = (slug: string) => all.filter((v) => v.product.slug === slug);
  let group = byProduct(HERO_PRODUCT);
  if (group.length === 0) {
    const multi = all.find((v) => v.model.tint && byProduct(v.product.slug).length > 1);
    group = multi ? byProduct(multi.product.slug) : all.slice(0, 1);
  }
  if (group.length === 0) return null;
  const rank = (v: Variant) => (v.name === HERO_COLOUR ? 2 : v.isDefault ? 1 : 0);
  return [...group].sort((a, b) => rank(b) - rank(a));
}

const frame = 'relative h-[360px] overflow-hidden rounded-3xl border border-line/10 bg-surface-raised shadow-product sm:h-[440px] lg:h-[540px]';

/**
 * A real catalogue model, live in 3D. On phones the viewer's own AR button places it.
 * Falls back to the product photo while the catalogue loads or if the API is down.
 */
export function HeroStage() {
  const catalog = useAsync(fetchVariants, 'variants');
  const variants = catalog.status === 'ready' ? heroVariants(catalog.data) : null;

  // While the catalogue loads, an empty stage: the photo is a different sofa, so flashing it first looks like a swap.
  if (catalog.status === 'loading') {
    return (
      <div className={frame} role="status" aria-label="Loading 3D model">
        <div aria-hidden className="absolute inset-0 animate-pulse bg-[radial-gradient(ellipse_at_50%_60%,rgb(var(--fg)/0.06),transparent_60%)]" />
        <p className="absolute inset-x-0 bottom-6 text-center text-xs text-fg-subtle">Loading 3D…</p>
      </div>
    );
  }

  // The API is down or the catalogue is empty: a photo beats a blank box.
  if (!variants) {
    return (
      <div className={frame}>
        <img
          src={IMAGES.heroSofa}
          alt="Emerald velvet sofa in a bright room"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }

  const active = variants.find((v) => v.name === HERO_COLOUR) ?? variants[0];

  return (
    <div className={frame}>
      {/* Soft floor light under the model. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(ellipse_at_50%_85%,rgb(var(--fg)/0.07),transparent_65%)]"
      />
      <ErrorBoundary
        resetKey={active.model.url}
        fallback={<img src={IMAGES.heroSofa} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />}
      >
        <ProductArExperience
          key={active.model.url}
          src={active.model.url}
          alt={`3D model of the ${active.product.name} in ${active.name}`}
          recolor={recolorOf(active)}
          variant={active}
          autoRotate
          disableZoom
          showArUnavailable={false}
          cameraOrbit={active.product.slug === HERO_PRODUCT ? HERO_ORBIT : undefined}
        />
      </ErrorBoundary>
      <p className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full border border-line/10 bg-surface/70 px-3 py-1.5 text-[11px] font-medium text-fg-soft backdrop-blur-md">
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live 3D · drag to rotate
      </p>
    </div>
  );
}
