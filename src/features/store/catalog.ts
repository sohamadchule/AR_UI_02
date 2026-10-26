import { fetchVariants, type Variant } from '@/lib/api';
import { displayDimensions } from '@/lib/units';
import type { Flagship } from '@/data/brands';
import { SAMPLE_PRODUCTS } from './sample';

/**
 * A storefront product: one `product` row with all its colour variants, shaped
 * for the shop rather than the viewer. Built from /api/variants, so the store
 * shows whatever is actually in the catalogue.
 *
 * When the catalogue is empty — a fresh database, or the API is down — the store
 * falls back to the bundled sample rows so it is never a blank page. Those rows
 * have no GLB behind them and are labelled as samples everywhere they appear.
 */
export interface StoreProduct {
  slug: string;
  name: string;
  description: string;
  blurb: string;
  category: { slug: string; name: string };
  priceInr: number | null;
  mrpInr: number | null;
  /** Default variant first. Empty on a sample row. */
  variants: Variant[];
  /** Shown instead of variant swatches on a sample row. */
  sampleFinishes: { name: string; hex: string }[];
  /** Shown instead of the GLB bounding box on a sample row, in cm. */
  sampleDimsCm: { width: number; depth: number; height: number } | null;
  isSample: boolean;
}

export interface StoreCatalogue {
  products: StoreProduct[];
  categories: { slug: string; name: string }[];
  /** True when nothing was found in the database and the sample rows are showing. */
  isSample: boolean;
}

function indexCategories(products: readonly StoreProduct[]) {
  const categories: { slug: string; name: string }[] = [];
  for (const p of products) {
    if (!categories.some((c) => c.slug === p.category.slug)) categories.push(p.category);
  }
  return categories;
}

/** Variants arrive flat, ordered by category → product → sort_order; group them. */
export function groupVariants(variants: readonly Variant[]): StoreProduct[] {
  const byProduct = new Map<string, StoreProduct>();

  for (const v of variants) {
    const existing = byProduct.get(v.product.id);
    if (existing) {
      existing.variants.push(v);
      continue;
    }
    byProduct.set(v.product.id, {
      slug: v.product.slug,
      name: v.product.name,
      description: v.product.description,
      blurb: v.product.blurb,
      category: v.category,
      priceInr: v.product.priceInr,
      mrpInr: v.product.mrpInr,
      variants: [v],
      sampleFinishes: [],
      sampleDimsCm: null,
      isSample: false,
    });
  }

  const products = [...byProduct.values()];
  for (const p of products) p.variants.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return products;
}

const sampleCatalogue = (): StoreCatalogue => ({
  products: SAMPLE_PRODUCTS,
  categories: indexCategories(SAMPLE_PRODUCTS),
  isSample: true,
});

export async function loadCatalogue(): Promise<StoreCatalogue> {
  const products = await fetchVariants().then(groupVariants).catch(() => [] as StoreProduct[]);
  if (products.length === 0) return sampleCatalogue();
  return { products, categories: indexCategories(products), isSample: false };
}

/** The variant a tile and the product page open on; undefined on a sample row. */
export const defaultVariant = (p: StoreProduct): Variant | undefined => p.variants[0];

export const formatInr = (n: number) => '₹' + n.toLocaleString('en-IN');

/** Discount as a whole percent, or null when there is no struck-through price. */
export function discountPercent(p: Pick<StoreProduct, 'priceInr' | 'mrpInr'>): number | null {
  if (p.priceInr === null || p.mrpInr === null || p.mrpInr <= p.priceInr) return null;
  return Math.round((1 - p.priceInr / p.mrpInr) * 100);
}

/** Twelve equal instalments, rounded up to the rupee. */
export const monthlyEmi = (priceInr: number) => Math.ceil(priceInr / 12);

/** Width / depth / height in cm, from the variant's real dimensions or the sample row. */
export function dimensionsCm(p: StoreProduct, v: Variant | undefined) {
  if (v) {
    const d = displayDimensions(v);
    if (d && d.width !== null && d.depth !== null && d.height !== null) {
      return { width: d.width / 10, depth: d.depth / 10, height: d.height / 10 };
    }
  }
  return p.sampleDimsCm;
}

/**
 * Whether the piece clears a standard Indian internal doorway (762 mm leaf).
 * The limiting measurement is the smaller of width and depth, because a sofa
 * goes through a door on its side.
 */
export function doorwayNote(dims: { width: number; depth: number } | null): string | null {
  if (!dims) return null;
  const narrowest = Math.round(Math.min(dims.width, dims.depth));
  return narrowest <= 76
    ? `Narrowest side is ${narrowest} cm — clears a standard 76 cm doorway.`
    : `Narrowest side is ${narrowest} cm — needs a 90 cm doorway, or the legs removed.`;
}

/**
 * A flagship shop's own collection: only the listed products, in its order, with
 * any finishes it has chosen not to offer taken out. Without a flagship, everything.
 */
export function curate(products: readonly StoreProduct[], flagship: Flagship | undefined): StoreProduct[] {
  if (!flagship) return [...products];
  return flagship.collection.flatMap((slug) => {
    const product = products.find((p) => p.slug === slug);
    if (!product) return [];
    const hidden = flagship.hiddenFinishes?.[slug] ?? [];
    const variants = product.variants.filter((v) => !hidden.includes(v.name));
    return [{ ...product, variants: variants.length > 0 ? variants : product.variants }];
  });
}
