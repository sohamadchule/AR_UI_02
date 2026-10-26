import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Cuboid, Menu, X } from 'lucide-react';
import { DEMO_PATH, NAV_LINKS, SITE } from '@/data/site';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { buttonClasses } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/cn';

/** Tab-reachable controls currently on screen inside `root`. */
function focusables(root: HTMLElement | null) {
  if (!root) return [] as HTMLElement[];
  return Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')).filter(
    (el) => el.offsetParent !== null,
  );
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrolled, hidden } = useScrollDirection();
  const { pathname } = useLocation();
  const headerRef = useRef<HTMLElement>(null);

  // Any navigation closes the sheet.
  useEffect(() => setMenuOpen(false), [pathname]);

  // While the sheet is open: lock page scroll, close on Escape, keep Tab inside the header.
  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables(headerRef.current);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const isActive = (to: string) => pathname === to;

  return (
    <header
      ref={headerRef}
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[transform,background-color,box-shadow,border-color] duration-300',
        scrolled || menuOpen
          ? 'border-b border-line/10 bg-surface/80 shadow-sm backdrop-blur-md'
          : 'border-b border-transparent',
        // Tuck away while scrolling down; any scroll up brings it back. Only keyboard focus
        // (:focus-visible) pins it open: a clicked link keeps plain focus after navigating.
        hidden && !menuOpen && '-translate-y-full has-[:focus-visible]:translate-y-0',
      )}
    >
      {/* One shared column with the page content below, so the logo lines up with the hero. */}
      <div
        className={cn(
          'mx-auto flex max-w-[1200px] items-center justify-between px-6 transition-[height] duration-300 md:px-8',
          scrolled ? 'h-[58px]' : 'h-[68px]',
        )}
      >
        <Link to="/" className="flex items-center gap-2.5" aria-label={`${SITE.name} home`}>
          <Cuboid className="h-[22px] w-[22px] text-fg-soft" aria-hidden />
          <span
            className={cn(
              'font-light uppercase tracking-[0.2em] text-fg transition-[font-size] duration-300',
              scrolled ? 'text-[17px]' : 'text-[19px]',
            )}
          >
            {SITE.name}
            <span className="text-fg-subtle">.</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={isActive(link.to) ? 'page' : undefined}
              className={cn(
                'relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors hover:text-fg',
                isActive(link.to)
                  ? 'text-fg after:absolute after:inset-x-3.5 after:-bottom-px after:h-0.5 after:rounded-full after:bg-fg'
                  : 'text-fg-muted',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden md:grid" />
          <Link to={DEMO_PATH} className={cn(buttonClasses('primary', 'sm'), 'hidden md:inline-flex')}>
            Book a demo
          </Link>

          {/* Mobile: the CTA stays visible next to the menu button. */}
          <Link
            to={DEMO_PATH}
            className={cn(buttonClasses('primary', 'sm'), 'h-8 px-4 text-[13px] md:hidden')}
          >
            Demo
          </Link>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg text-fg-soft transition-colors hover:bg-fg/[0.06] md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="h-[calc(100dvh-58px)] overflow-y-auto border-t border-line/10 bg-surface px-6 pb-10 pt-4 md:hidden"
      >
        <nav aria-label="Primary" className="flex flex-col">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={isActive(link.to) ? 'page' : undefined}
              className={cn(
                'rounded-xl px-3 py-3.5 text-base font-medium transition-colors',
                isActive(link.to) ? 'bg-fg/[0.05] text-fg' : 'text-fg-soft',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <hr className="my-4 border-line/10" />

        <Link to={DEMO_PATH} className={cn(buttonClasses('primary', 'sm'), 'h-12 w-full text-[15px]')}>
          Book a demo
        </Link>

        <div className="mt-2 flex items-center justify-between px-3 py-2.5 text-sm text-fg-muted">
          <span>Appearance</span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
