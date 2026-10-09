import ProductArExperience from './ProductArExperience';
import type { Variant } from '@/lib/api';

/** The framed 3D + AR viewer for one variant. Remounts cleanly when the variant changes. */
export function ModelStage({ variant, className = '' }: { variant: Variant; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-line/10 bg-surface-raised ${className}`}>
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
      <ProductArExperience
        key={variant.id}
        src={variant.model.url}
        alt={`3D model of ${variant.product.name}, ${variant.name}`}
      />
    </div>
  );
}
