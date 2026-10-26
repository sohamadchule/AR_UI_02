import type { MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { storeExperiencePath, storePath, telLink, whatsappLink, type Brand } from '@/data/brands';
import { SECTION, type Showroom } from '@/data/showrooms';
import { scrollToSection } from './scroll';

/** The shop's footer. The shop is the brand; Akruti appears only as the technology credit. */
export function ShopFooter({ brand, showroom }: { brand: Brand; showroom: Showroom }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const home = storePath(brand.slug);
  const onHome = pathname.replace(/\/$/, '') === home;

  const toSection = (e: MouseEvent, id: string) => {
    e.preventDefault();
    if (onHome) scrollToSection(id);
    else navigate(`${home}#${id}`);
  };
  const sectionLink = (id: string, label: string) => (
    <a href={`${home}#${id}`} onClick={(e) => toSection(e, id)} className="transition-colors hover:text-fg">
      {label}
    </a>
  );
  const heading = 'mb-4 text-[10px] uppercase tracking-[0.26em] text-fg-subtle';

  return (
    <footer className="border-t border-line/10 bg-surface-sunken text-sm text-fg-muted">
      <div className="mx-auto grid w-full max-w-[1280px] gap-12 px-5 py-16 sm:px-8 md:grid-cols-12">
        <div className="md:col-span-5">
          <Link to={home} className="store-mark text-3xl text-fg">
            {brand.legalName}
          </Link>
          <p className="mt-4 max-w-[38ch] leading-relaxed">{showroom.footerBlurb}</p>
        </div>

        <nav aria-label="Footer" className="md:col-span-2">
          <p className={heading}>Explore</p>
          <ul className="space-y-2.5">
            <li>{sectionLink(SECTION.showroom, 'The showroom')}</li>
            <li>{sectionLink(SECTION.collection, 'Collection')}</li>
            <li>
              <Link to={storeExperiencePath(brand.slug)} className="transition-colors hover:text-fg">
                Experience in 3D
              </Link>
            </li>
            <li>{sectionLink(SECTION.about, 'About the shop')}</li>
            <li>{sectionLink(SECTION.visit, 'Contact')}</li>
          </ul>
        </nav>

        <div className="md:col-span-3">
          <p className={heading}>Visit</p>
          <address className="not-italic leading-relaxed">
            {brand.contact.address.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
          <ul className="mt-3 space-y-1.5">
            {brand.contact.hours.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2">
          <p className={heading}>Contact</p>
          <ul className="space-y-2.5">
            <li>
              <a href={telLink(brand)} className="transition-colors hover:text-fg">
                {brand.contact.phone}
              </a>
            </li>
            <li>
              <a href={whatsappLink(brand)} target="_blank" rel="noreferrer" className="transition-colors hover:text-fg">
                WhatsApp
              </a>
            </li>
            {showroom.social.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="transition-colors hover:text-fg">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-line/10">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-fg-subtle sm:px-8">
          <span>
            © {new Date().getFullYear()} {brand.legalName} · {brand.city}
          </span>
          <Link to="/" className="transition-colors hover:text-fg-muted">
            Digital experience powered by <span className="text-fg-muted">Akruti</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
