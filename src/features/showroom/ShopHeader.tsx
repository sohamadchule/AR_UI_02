import { useEffect, useState, type MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { storeExperiencePath, storePath, type Brand } from '@/data/brands';
import { SECTION, type Showroom } from '@/data/showrooms';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { scrollToSection } from './scroll';
import { cn } from '@/lib/cn';

interface NavItem {
  label: string;
  /** A section on the showroom home page… */
  section?: string;
  /** …or a separate page. */
  to?: string;
}

const navItems = (brand: Brand): NavItem[] => [
  { label: 'Home', section: SECTION.top },
  { label: 'Experience', to: storeExperiencePath(brand.slug) },
  { label: 'Collection', section: SECTION.collection },
  { label: 'About the Shop', section: SECTION.about },
  { label: 'Contact', section: SECTION.visit },
];

/**
 * The shop's own header. Over the home page's hero it is transparent with light text;
 * once the page scrolls (or on any other page) it turns into a solid, blurred bar.
 * Section links scroll smoothly on the home page and navigate there from elsewhere.
 */
export function ShopHeader({ brand, showroom }: { brand: Brand; showroom: Showroom }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const home = storePath(brand.slug);
  const onHome = pathname.replace(/\/$/, '') === home;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  // Close the mobile menu on navigation.
  useEffect(() => setOpen(false), [pathname]);

  const overHero = onHome && !scrolled && !open;

  function onSectionClick(e: MouseEvent, section: string) {
    e.preventDefault();
    setOpen(false);
    if (onHome) scrollToSection(section);
    // From another page: go home; ScrollManager scrolls to the #section once it renders.
    else navigate(section === SECTION.top ? home : `${home}#${section}`);
  }

  const linkFor = (item: NavItem, className: string) =>
    item.section ? (
      <a
        key={item.label}
        href={`${home}#${item.section}`}
        onClick={(e) => onSectionClick(e, item.section!)}
        className={className}
      >
        {item.label}
      </a>
    ) : (
      <Link key={item.label} to={item.to!} className={className} aria-current={pathname === item.to ? 'page' : undefined}>
        {item.label}
      </Link>
    );

  return (
    <header
      className={cn(
        'z-50 w-full transition-[background-color,color,border-color,backdrop-filter] duration-500',
        onHome ? 'fixed inset-x-0 top-0' : 'sticky top-0',
        overHero
          ? 'border-b border-transparent bg-transparent text-ivory'
          : 'border-b border-line/10 bg-surface/85 text-fg backdrop-blur-md',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-6 px-5 sm:px-8 md:h-20">
        <a
          href={home}
          onClick={(e) => onSectionClick(e, SECTION.top)}
          className="flex min-w-0 items-baseline gap-3"
          aria-label={`${brand.legalName}, home`}
        >
          <span className="store-mark truncate text-[1.45rem] leading-none md:text-[1.6rem]">{brand.legalName}</span>
          {showroom.poweredByLabel && (
            <span className={cn('hidden whitespace-nowrap text-[10px] uppercase tracking-[0.2em] lg:inline', overHero ? 'text-ivory/60' : 'text-fg-subtle')}>
              Powered by Akruti
            </span>
          )}
        </a>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {navItems(brand).map((item) =>
            linkFor(
              item,
              cn(
                'group relative py-1 text-[13px] tracking-[0.04em] transition-opacity duration-300',
                overHero ? 'text-ivory/80 hover:text-ivory' : 'text-fg-muted hover:text-fg',
                // A hairline that draws in from the left on hover.
                "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-500 after:ease-out-expo after:content-[''] hover:after:scale-x-100",
              ),
            ),
          )}
        </nav>

        <div className="flex items-center gap-1">
          <div className={overHero ? '[&_button]:text-ivory/80 [&_button:hover]:text-ivory' : undefined}>
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="shop-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid h-10 w-10 place-items-center md:hidden"
          >
            {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>

      <nav id="shop-menu" aria-label="Main" hidden={!open} className="border-t border-line/10 bg-surface px-5 pb-6 pt-2 md:hidden">
        {navItems(brand).map((item) =>
          linkFor(item, 'block border-b border-line/10 py-4 font-display text-2xl text-fg'),
        )}
      </nav>
    </header>
  );
}
