import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, X } from 'lucide-react';
import { storeProductPath, type Brand } from '@/data/brands';
import { ModelStage } from '@/features/experience/ModelStage';
import { ColourSwatches } from '@/features/experience/ColourSwatches';
import { QrPanel } from '@/features/experience/QrPanel';
import type { StoreProduct } from '@/features/store/catalog';
import { usePartPicks } from '@/hooks/usePartPicks';
import type { PartPicks } from '@/lib/color';

export type ViewerMode = '3d' | 'room';

/**
 * A modal for one piece: its live 3D model (with colours), or — on a computer —
 * the QR code that opens it in AR on a phone. Uses the native <dialog>, so focus
 * is trapped, Escape closes it, and the page behind is inert.
 */
export function ViewerDialog({
  brand,
  product,
  mode,
  initialVariantId,
  initialPicks,
  onClose,
}: {
  brand: Brand;
  product: StoreProduct;
  mode: ViewerMode;
  /** The colour to open on; the product's default otherwise. */
  initialVariantId?: string;
  /** Colours already picked for the product's extra parts, carried into the dialog. */
  initialPicks?: PartPicks;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [variantId, setVariantId] = useState(initialVariantId ?? product.variants[0]?.id ?? '');
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const { picksFor, pick } = usePartPicks();
  const picks = { ...initialPicks, ...picksFor(product.slug) };

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (!d.open) d.showModal();
    document.documentElement.style.overflow = 'hidden';
    // No d.close() here: it fires `close` → onClose, which (with StrictMode's mount–unmount–mount)
    // would shut the dialog the moment it opened. Unmounting removes it from the page anyway.
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, []);

  if (!variant) return null;
  const title = mode === '3d' ? `${product.name} in 3D` : `Place the ${product.name} in your room`;

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="m-auto w-[min(960px,calc(100vw-24px))] max-w-none overflow-visible rounded-store border border-line/15 bg-surface p-0 text-fg backdrop:bg-night/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line/10 px-5 py-4 sm:px-7">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.24em] text-fg-subtle">{product.category.name}</p>
          <h2 className="mt-1 truncate font-display text-2xl sm:text-3xl">{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg">
          <X size={20} aria-hidden />
        </button>
      </div>

      {mode === '3d' ? (
        <div className="space-y-5 p-5 sm:p-7">
          <ModelStage variant={variant} picks={picks} className="h-[min(56vh,520px)] w-full !rounded-store" />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <ColourSwatches
              variants={product.variants}
              activeId={variant.id}
              onSelect={setVariantId}
              picks={picks}
              onPick={(part, hex) => pick(product.slug, part, hex)}
            />
            <Link
              to={storeProductPath(brand.slug, product.slug)}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-sm text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
            >
              Full details <ArrowUpRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5 p-5 sm:p-7">
          <p className="max-w-[56ch] text-sm leading-relaxed text-fg-muted">
            Scan this code with your phone. The {product.name} opens on your phone, and you can place it in your room at its real size
            (on phones that support AR).
          </p>
          <QrPanel variant={variant} picks={picks} />
        </div>
      )}
    </dialog>
  );
}
