import { Outlet } from 'react-router-dom';
import type { Brand } from '@/data/brands';
import type { Showroom } from '@/data/showrooms';
import { ScrollManager } from '@/components/layout/ScrollManager';
import { ShopHeader } from './ShopHeader';
import { ShopFooter } from './ShopFooter';

/**
 * Chrome for a shop that has an immersive showroom site: its own header and footer
 * around every page of the store (home, product pages, the 3D experience).
 * `data-brand` re-skins everything inside with the shop's colours and type.
 */
export function ShowroomLayout({ brand, showroom }: { brand: Brand; showroom: Showroom }) {
  return (
    <div data-brand={brand.slug} className="flex min-h-screen flex-col bg-surface font-body text-fg antialiased">
      <ScrollManager />
      <ShopHeader brand={brand} showroom={showroom} />
      <main className="flex-1">
        <Outlet context={brand} />
      </main>
      <ShopFooter brand={brand} showroom={showroom} />
    </div>
  );
}
