import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Ruler, ScanLine } from 'lucide-react';
import { storeProductPath, type Brand } from '@/data/brands';
import { qrUrl } from '@/lib/api';
import { ModelStage } from '@/features/experience/ModelStage';
import { PartColourRows } from '@/features/experience/ColourSwatches';
import { usePartPicks } from '@/hooks/usePartPicks';
import { encodePicks, tintParts } from '@/lib/color';
import { defaultVariant, dimensionsCm, doorwayNote, formatInr, type StoreProduct } from '../catalog';
import { cn } from '@/lib/cn';

/**
 * The reason the shop pays for Akruti, made the centre of the home page: one
 * signature piece live in 3D, its finishes, its true size, and a single step to
 * see it in the buyer's own room (the viewer's AR button on a phone, a QR on desktop).
 */
export function VisualiseSection({ brand, product }: { brand: Brand; product: StoreProduct }) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const { picksFor, pick } = usePartPicks();
  const variant = product.variants.find((v) => v.id === pickedId) ?? defaultVariant(product);
  if (!variant) return null;
  const picks = picksFor(product.slug);
  const parts = variant.model.tint ? tintParts(variant.model.tint) : [];

  const dims = dimensionsCm(product, variant);
  const size = dims && `${Math.round(dims.width)} × ${Math.round(dims.depth)} × ${Math.round(dims.height)} cm`;

  return (
    <section id="visualise" aria-labelledby="visualise-title" className="border-y border-line/10 bg-surface-raised">
      <div className="mx-auto grid w-full max-w-[1180px] items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-14 md:py-24">
        <div className="min-w-0">
          <p className="eyebrow text-fg-subtle">Before the saw touches wood</p>
          <h2 id="visualise-title" className="mt-3 font-display text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.05] tracking-tight text-balance">
            Your piece doesn&apos;t exist yet. <em className="not-italic text-accent">See it anyway.</em>
          </h2>
          <p className="mt-4 max-w-[46ch] text-fg-muted">
            We build after you order. So turn the {product.name} around, change its fabric, and put it in your own room
            at its true size — before we cut a single board.
          </p>

          <div className="mt-8 flex flex-col gap-2">
            <span className="eyebrow text-fg-subtle">
              {parts.length > 1 ? parts[0].name : 'Fabric'} · <span className="text-fg">{variant.name}</span>
            </span>
            <div role="radiogroup" aria-label="Choose a fabric" className="flex flex-wrap gap-2">
              {product.variants.map((v) => {
                const selected = v.id === variant.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPickedId(v.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition-colors',
                      selected ? 'border-accent bg-accent/10' : 'border-line/15 hover:border-fg/35',
                    )}
                  >
                    <i
                      className="block h-[18px] w-[18px] shrink-0 rounded-full border border-fg/15"
                      style={{ backgroundColor: v.colorHex ?? 'transparent' }}
                    />
                    {v.name}
                  </button>
                );
              })}
            </div>
          </div>
          <PartColourRows className="mt-6" variant={variant} picks={picks} onPick={(part, hex) => pick(product.slug, part, hex)} />

          {size && (
            <div className="mt-6 flex gap-3 border-t border-line/10 pt-5 text-sm">
              <Ruler size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
              <p>
                <span className="font-semibold tabular-nums">{size}</span>
                <span className="block text-fg-muted">{doorwayNote(dims)}</span>
              </p>
            </div>
          )}

          {/* Desktop: hand the piece to the phone. On a phone the viewer's own button opens AR. */}
          <div className="mt-6 hidden items-center gap-4 rounded-store border border-line/12 bg-surface p-3 pr-5 md:flex">
            <img
              key={variant.id}
              src={qrUrl(variant.id, { mix: encodePicks(variant.model.tint, picks) })}
              alt={`QR code: open the ${product.name} in ${variant.name} on your phone`}
              width={84}
              height={84}
              className="h-[84px] w-[84px] shrink-0 bg-white p-1"
            />
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                <ScanLine size={13} aria-hidden /> Scan with your phone
              </p>
              <p className="mt-1 text-sm leading-snug">Point it at your floor. The {product.name.split(' ')[0]} appears at real size.</p>
            </div>
          </div>
          <p className="mt-6 text-sm text-fg-muted md:hidden">
            Tap <b className="text-fg">View in AR</b> on the model above to place it in your room.
          </p>

          <Link
            to={storeProductPath(brand.slug, product.slug)}
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
          >
            {product.priceInr !== null && <span className="tabular-nums">{formatInr(product.priceInr)} ·</span>} Order this piece
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>

        {/* On a phone the model leads: it carries the "View in AR" button. */}
        <div className="relative order-first min-w-0 md:order-none">
          <ModelStage variant={variant} picks={picks} className="aspect-square w-full md:aspect-[5/4]" showArUnavailable={false} />
          {size && (
            <span className="pointer-events-none absolute left-3 top-3 rounded-full border border-line/15 bg-surface/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-soft backdrop-blur-md">
              True size · {size}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
