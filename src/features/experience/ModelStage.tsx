import ProductArExperience from './ProductArExperience';
import type { Variant } from '@/lib/api';
import { recolorOf } from '@/lib/color';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

/**
 * The framed 3D + AR viewer for one variant. Remounts only when the model file
 * changes; switching between colours of the same model just recolours it.
 */
export function ModelStage({
  variant,
  className = '',
  showArUnavailable,
}: {
  variant: Variant;
  className?: string;
  /** Off where the page offers another way into AR (a QR), so desktops aren't told "AR unavailable". */
  showArUnavailable?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-line/10 bg-surface-raised ${className}`}>
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
      <ErrorBoundary resetKey={variant.model.url} fallback={<p role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-fg-muted">The 3D view hit a problem. Reload the page to try again.</p>}>
        <ProductArExperience
          key={variant.model.url}
          src={variant.model.url}
          alt={`3D model of ${variant.product.name}, ${variant.name}`}
          recolor={recolorOf(variant)}
          showArUnavailable={showArUnavailable}
        />
      </ErrorBoundary>
    </div>
  );
}
