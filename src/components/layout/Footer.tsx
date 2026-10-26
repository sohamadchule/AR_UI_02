import { Link } from 'react-router-dom';
import { Cuboid } from 'lucide-react';
import { FOOTER_LINKS, SITE } from '@/data/site';

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-line/10 bg-surface-sunken px-6 pb-12 pt-10 md:px-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <Link to="/" className="flex items-center gap-2 text-fg-soft" aria-label={`${SITE.name} home`}>
            <Cuboid size={18} aria-hidden />
            <span className="font-light uppercase tracking-[0.2em] text-fg">
              {SITE.name}
              <span className="text-fg-subtle">.</span>
            </span>
          </Link>
          <p className="text-sm text-fg-muted">3D and AR for furniture brands.</p>
        </div>

        <nav aria-label="Footer" className="flex gap-8 text-sm text-fg-muted">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.label} to={link.to} className="transition-colors hover:text-fg">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <p className="mx-auto mt-8 max-w-7xl text-center text-xs text-fg-subtle md:text-left">
        {SITE.platform} © {new Date().getFullYear()}
      </p>
    </footer>
  );
}
