import { useEffect } from 'react';
import type { Brand } from '@/data/brands';
import type { Showroom } from '@/data/showrooms';
import type { StoreCatalogue } from '@/features/store/catalog';
import { ShopHero } from '@/features/showroom/ShopHero';
import { ShowroomWalkthrough } from '@/features/showroom/ShowroomWalkthrough';
import { FurnitureCollection } from '@/features/showroom/FurnitureCollection';
import { FeaturedProduct } from '@/features/showroom/FeaturedProduct';
import { ShopAbout, ShopClosing, ShopContact, ShopHighlights } from '@/features/showroom/ShopSections';

/** Sets the page title and description while mounted, and puts the previous ones back after. */
function useSeo(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    const previousDescription = meta.content;
    document.title = title;
    meta.content = description;
    return () => {
      document.title = previousTitle;
      if (created) meta!.remove();
      else meta!.content = previousDescription;
    };
  }, [title, description]);
}

/**
 * The immersive showroom home page: the shop → walking in → the collection → one
 * piece up close → why us → the story → how to visit. Its words and pictures come
 * from src/data/showrooms.ts; its products from the live catalogue.
 */
export function ShowroomHomePage({
  brand,
  showroom,
  catalogue: data,
}: {
  brand: Brand;
  showroom: Showroom;
  /** The live catalogue, or null while it loads. */
  catalogue: StoreCatalogue | null;
}) {
  useSeo(showroom.seo.title, showroom.seo.description);
  const featured = data?.products.find((p) => p.slug === showroom.featured.productSlug && p.variants.length > 0);

  return (
    <>
      <ShopHero brand={brand} showroom={showroom} />
      <ShowroomWalkthrough brand={brand} showroom={showroom} />
      <FurnitureCollection brand={brand} showroom={showroom} catalogue={data} />
      {featured && <FeaturedProduct brand={brand} showroom={showroom} product={featured} />}
      <ShopHighlights showroom={showroom} />
      <ShopAbout brand={brand} showroom={showroom} />
      <ShopContact brand={brand} showroom={showroom} />
      <ShopClosing showroom={showroom} />
    </>
  );
}
