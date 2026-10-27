import { useCallback, useState } from 'react';
import type { PartPicks } from '@/lib/color';

const NONE: PartPicks = {};

/**
 * The colours a shopper has picked for products' extra parts, per product. They survive
 * switching the main colour (another variant of the same product) and browsing away and back.
 * Nothing is saved: it only changes what this page shows.
 */
export function usePartPicks() {
  const [byProduct, setByProduct] = useState<Record<string, PartPicks>>({});
  const picksFor = useCallback((productId: string) => byProduct[productId] ?? NONE, [byProduct]);
  const pick = useCallback(
    (productId: string, part: number, hex: string) => setByProduct((s) => ({ ...s, [productId]: { ...s[productId], [part]: hex } })),
    [],
  );
  return { picksFor, pick };
}
