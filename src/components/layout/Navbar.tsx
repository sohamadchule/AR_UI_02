import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Cuboid, Menu, X } from 'lucide-react';
import { NAV_LINKS, SITE } from '@/data/site';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/cn';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrolled, hidden: scrolledDown } = useScrollDirection();
  const { pathname } = useLocation();

  // Lock page scroll and close on Escape while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);
  // Tucks away while scrolling down, returns on any upward scroll; always shown with the mobile menu open.
  const hidden = scrolledDown && !menuOpen;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 flex items-center justify-between px-8 transition-all duration-500 md:px-12',
        scrolled && !menuOpen ? 'border-b border-line/10 bg-surface/80 py-4 backdrop-blur-md' : 'py-6',
        hidden && 'pointer-events-none -translate-y-full opacity-0',
      )}
    >
      <Link to="/" onClick={() => setMenuOpen(false)} className="z-50 flex items-center gap-2" aria-label={`${SITE.name} home`}>
        <Cuboid className={'h-6 w-6 text-fg-soft'} aria-hidden />
        <span className={'text-xl font-light uppercase tracking-[0.2em] text-fg'}>
          {SITE.name}
          <span className="text-fg-subtle">.</span>
        </span>
      </Link>

      <div className="flex items-center">
        <nav aria-label="Primary" className="hidden items-center gap-10 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={link.to === pathname ? 'page' : undefined}
              className={cn(
                'text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:text-fg',
                link.to === pathname ? 'text-fg' : 'text-fg-muted',
              )}
            >
              {link.label}
            </Link>
          ))}
          <span aria-hidden className="h-5 w-px bg-line/15" />
          <ThemeToggle />
          <Button variant="outline" size="md" className="h-10">
            Request Access
          </Button>
        </nav>

        <button
          type="button"
          className="z-50 flex h-10 w-10 items-center justify-center rounded-full text-fg-soft md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-surface/95 backdrop-blur-xl md:hidden"
      >
        {NAV_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            onClick={close}
            className="text-xl uppercase tracking-[0.2em] text-fg-soft"
          >
            {link.label}
          </Link>
        ))}
        <Button variant="outline" onClick={close} className="mt-4">
          Request Access
        </Button>
        <ThemeToggle className="mt-2" />
      </div>
    </header>
  );
}
