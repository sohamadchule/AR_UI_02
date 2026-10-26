import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { Menu, Phone, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import {
  BRANDS,
  DEFAULT_BRAND,
  brandBySlug,
  storeAboutPath,
  storeContactPath,
  storeExperiencePath,
  storePath,
  telLink,
} from '@/data/brands';
import { showroomBySlug } from '@/data/showrooms';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ShowroomLayout } from '@/features/showroom/ShowroomLayout';
import { ScrollManager } from './ScrollManager';
import { cn } from '@/lib/cn';

const pages = (slug: string) => [
  { to: storePath(slug), label: 'Shop', end: true },
  { to: storeExperiencePath(slug), label: 'Experience', end: false },
  { to: storeAboutPath(slug), label: 'About', end: false },
];

/**
 * Chrome for a client storefront. Sets `data-brand`, which is the whole re-skin:
 * every token the app styles with is redefined under that attribute, so nothing
 * below needs a conditional class.
 *
 * Deliberately shares nothing with the Akruti marketing Navbar — a client's shop
 * should not look like a page on our site.
 */
export function StoreLayout() {
  const { brandSlug } = useParams();
  const brand = brandBySlug(brandSlug) ?? DEFAULT_BRAND;
  const [menuOpen, setMenuOpen] = useState(false);
  const home = storePath(brand.slug);
  const nav = pages(brand.slug);

  // A shop with an immersive showroom site gets that site's own header and footer.
  const showroom = showroomBySlug(brand.slug);
  if (showroom) return <ShowroomLayout brand={brand} showroom={showroom} />;

  return (
    <div data-brand={brand.slug} className="flex min-h-screen flex-col bg-surface font-body text-fg">
      <ScrollManager />
      <header className="sticky top-0 z-40 border-b border-line/10 bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link to={home} className="store-mark whitespace-nowrap text-xl" aria-label={`${brand.legalName} home`}>
            {brand.mark[0]} <span className="text-accent">{brand.mark[1]}</span>
          </Link>

          <nav aria-label="Store" className="hidden items-center gap-1 md:flex">
            {nav.map((page) => (
              <NavLink
                key={page.to}
                to={page.to}
                end={page.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-store px-3 py-1.5 text-sm transition-colors hover:bg-fg/[0.06] hover:text-fg',
                    isActive ? 'text-fg' : 'text-fg-muted',
                  )
                }
              >
                {page.label}
              </NavLink>
            ))}
            <Link
              to={storeContactPath(brand.slug)}
              className="rounded-store px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
            >
              Contact
            </Link>
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <a
              href={telLink(brand)}
              aria-label={`Call ${brand.legalName}`}
              className="hidden h-9 w-9 place-items-center rounded-store text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg sm:grid"
            >
              <Phone size={17} aria-hidden />
            </a>
            <button type="button" aria-label="Bag, empty" className="grid h-9 w-9 place-items-center rounded-store text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg">
              <ShoppingBag size={17} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="store-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="grid h-9 w-9 place-items-center rounded-store text-fg-soft transition-colors hover:bg-fg/[0.06] md:hidden"
            >
              <Menu size={18} aria-hidden />
            </button>
          </div>
        </div>

        <nav id="store-menu" aria-label="Store" hidden={!menuOpen} className="border-t border-line/10 px-4 py-2 md:hidden">
          {[...nav, { to: storeContactPath(brand.slug), label: 'Contact' }].map((page) => (
            <Link
              key={page.label}
              to={page.to}
              onClick={() => setMenuOpen(false)}
              className="block rounded-store px-3 py-2.5 text-[15px] text-fg-soft"
            >
              {page.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <Outlet context={brand} />
      </main>

      <footer className="border-t border-line/10 bg-surface-raised">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 py-9 text-sm text-fg-subtle sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span>
              © {new Date().getFullYear()} {brand.legalName} · {brand.city}
            </span>
            <nav className="flex flex-wrap gap-5">
              <Link to={home} className="transition-colors hover:text-fg-soft">Shipping</Link>
              <Link to={home} className="transition-colors hover:text-fg-soft">Returns</Link>
              <Link to={home} className="transition-colors hover:text-fg-soft">Care guide</Link>
              <Link to={storeAboutPath(brand.slug)} className="transition-colors hover:text-fg-soft">About</Link>
              <Link to={storeContactPath(brand.slug)} className="transition-colors hover:text-fg-soft">Contact</Link>
            </nav>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/10 pt-5">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-line/25 px-3.5 py-1.5 text-xs transition-colors hover:text-fg-soft"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
                <path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z" />
                <path d="m3.3 7.3 8.7 4.7 8.7-4.7M12 12v9.5" />
              </svg>
              3D &amp; AR by <b className="font-semibold text-fg-muted">Akruti</b>
            </Link>

            {/* Demo affordance: the same storefront under each client's brand kit. */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-fg-subtle">Brand kit:</span>
              {BRANDS.map((b) => (
                <Link
                  key={b.slug}
                  to={storePath(b.slug)}
                  aria-current={b.slug === brand.slug ? 'page' : undefined}
                  className={cn(
                    'rounded-full border px-2.5 py-1 transition-colors',
                    b.slug === brand.slug ? 'border-accent text-fg' : 'border-line/20 text-fg-subtle hover:text-fg-muted',
                  )}
                >
                  {b.mark[0]}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
