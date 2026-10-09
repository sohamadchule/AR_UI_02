import { Cuboid } from 'lucide-react';
import { FOOTER_LINKS, SITE } from '@/data/site';

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-line/10 bg-surface-sunken px-6 pb-12 pt-8 md:px-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs uppercase tracking-widest text-fg-subtle md:flex-row">
        <p className="flex items-center gap-2">
          <Cuboid size={16} aria-hidden /> {SITE.platform} © {new Date().getFullYear()}
        </p>
        <nav aria-label="Legal" className="flex gap-8">
          {FOOTER_LINKS.map((link) => (
            <a key={link.label} href={link.to} className="transition-colors hover:text-fg-soft">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
