import { Clock, Hand, MapPin, MessageCircle, Navigation, Phone, Ruler, ScanLine, Sofa, Store, type LucideIcon } from 'lucide-react';
import { telLink, whatsappLink, type Brand } from '@/data/brands';
import { SECTION, photoProps, type HighlightIcon, type Showroom } from '@/data/showrooms';
import { Reveal } from '@/components/ui/Reveal';
import { PlaceholderNote } from './PlaceholderNote';
import { scrollToSection } from './scroll';

const ICONS: Record<HighlightIcon, LucideIcon> = { sofa: Sofa, ruler: Ruler, hand: Hand, store: Store, scan: ScanLine };

const eyebrow = 'text-[11px] font-medium uppercase tracking-[0.32em] text-olive';
const heading = 'font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[1.02] tracking-[-0.01em]';

export const directionsUrl = (brand: Brand) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(brand.contact.mapQuery)}`;
const mapEmbedUrl = (brand: Brand) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(brand.contact.mapQuery)}&z=15&output=embed`;

/* ------------------------------------------------------------ why us */

export function ShopHighlights({ showroom }: { showroom: Showroom }) {
  const { title, items } = showroom.highlights;
  return (
    <section aria-labelledby="why-title" className="bg-surface py-24 md:py-32">
      <div className="mx-auto grid w-full max-w-[1280px] gap-14 px-5 sm:px-8 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <p className={eyebrow}>Why shop with us</p>
            <h2 id="why-title" className={`${heading} mt-5`}>
              {title[0]}
              <br />
              <em className="text-fg-muted">{title[1]}</em>
            </h2>
            <div className="mt-6">
              <PlaceholderNote show={showroom.placeholders.highlights}>confirm these with the shop</PlaceholderNote>
            </div>
          </div>
        </Reveal>
        <ol className="lg:col-span-7">
          {items.map((item, i) => {
            const Icon = ICONS[item.icon];
            return (
              <Reveal as="li" key={item.title} className="grid grid-cols-[3rem_1fr] gap-x-6 border-t border-line/12 py-8 last:border-b sm:grid-cols-[4rem_1fr_auto]">
                <span className="pt-1 font-display text-xl tabular-nums text-fg-subtle">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-display text-2xl md:text-[1.75rem]">{item.title}</h3>
                  <p className="mt-2 max-w-[48ch] leading-relaxed text-fg-muted">{item.text}</p>
                </div>
                <Icon size={22} strokeWidth={1.4} aria-hidden className="col-start-2 mt-4 text-olive sm:col-start-auto sm:mt-1" />
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- about */

export function ShopAbout({ brand, showroom }: { brand: Brand; showroom: Showroom }) {
  const { about } = showroom;
  const facts: [string, string][] = [
    ...(brand.about.since ? ([['Established', String(brand.about.since)]] as [string, string][]) : []),
    ...(about.owner ? ([['Owner', about.owner]] as [string, string][]) : []),
    ['Location', brand.city],
  ];

  return (
    <section id={SECTION.about} aria-labelledby="about-title" className="scroll-mt-16 bg-surface-raised py-24 md:py-32">
      <div className="mx-auto grid w-full max-w-[1280px] gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:items-center lg:gap-20">
        <Reveal className="lg:col-span-6">
          <figure className="relative">
            <img {...photoProps(about.photo, '(min-width: 1024px) 50vw, 100vw')} loading="lazy" className="aspect-[4/5] w-full object-cover sm:aspect-[5/4] lg:aspect-[4/5]" />
            {about.teamPhoto && (
              <img
                {...photoProps(about.teamPhoto, '30vw')}
                loading="lazy"
                className="absolute -bottom-10 -right-4 hidden aspect-square w-[42%] border-[6px] border-surface-raised object-cover md:block"
              />
            )}
            <figcaption className="mt-3">
              <PlaceholderNote show={showroom.placeholders.photos}>stock photo — use the shop’s own</PlaceholderNote>
            </figcaption>
          </figure>
        </Reveal>

        <Reveal className="lg:col-span-6">
          <p className={eyebrow}>About the shop</p>
          <h2 id="about-title" className={`${heading} mt-5`}>
            {about.title}
          </h2>
          <div className="mt-7 space-y-4 text-lg leading-relaxed text-fg-soft">
            {about.story.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <div className="mt-4">
            <PlaceholderNote show={showroom.placeholders.story}>sample story — replace with the owner’s own words</PlaceholderNote>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-line/12 pt-7 sm:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] uppercase tracking-[0.24em] text-fg-subtle">{k}</dt>
                <dd className="mt-1.5 font-display text-2xl">{v}</dd>
              </div>
            ))}
          </dl>
          {about.specialties.length > 0 && (
            <div className="mt-8">
              <p className="text-[10px] uppercase tracking-[0.24em] text-fg-subtle">Specialties</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {about.specialties.map((s) => (
                  <li key={s} className="border border-line/15 px-3.5 py-1.5 text-sm text-fg-soft">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- visit */

export function ShopContact({ brand, showroom }: { brand: Brand; showroom: Showroom }) {
  const { contact } = brand;
  const button = 'inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-medium transition-colors';

  return (
    <section id={SECTION.visit} aria-labelledby="visit-title" className="scroll-mt-16 bg-surface py-24 md:py-32">
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8">
        <Reveal className="max-w-3xl">
          <p className={eyebrow}>Visit our showroom</p>
          <h2 id="visit-title" className={`${heading} mt-5`}>
            {showroom.visit.title[0]}
            <br />
            <em className="text-fg-muted">{showroom.visit.title[1]}</em>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <dl className="space-y-7">
              <div className="flex gap-4">
                <MapPin size={20} strokeWidth={1.5} aria-hidden className="mt-1 shrink-0 text-olive" />
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.24em] text-fg-subtle">Address</dt>
                  <dd className="mt-1.5 text-lg leading-snug">
                    <address className="not-italic">
                      {contact.address.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </address>
                  </dd>
                </div>
              </div>
              <div className="flex gap-4">
                <Phone size={20} strokeWidth={1.5} aria-hidden className="mt-1 shrink-0 text-olive" />
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.24em] text-fg-subtle">Phone &amp; WhatsApp</dt>
                  <dd className="mt-1.5 text-lg">
                    <a href={telLink(brand)} className="underline-offset-4 hover:underline">
                      {contact.phone}
                    </a>
                  </dd>
                </div>
              </div>
              <div className="flex gap-4">
                <Clock size={20} strokeWidth={1.5} aria-hidden className="mt-1 shrink-0 text-olive" />
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.24em] text-fg-subtle">Opening hours</dt>
                  <dd className="mt-1.5 text-lg leading-snug">
                    {contact.hours.map((h) => (
                      <span key={h} className="block">
                        {h}
                      </span>
                    ))}
                  </dd>
                </div>
              </div>
            </dl>

            <div className="mt-10 flex flex-wrap gap-3">
              <a href={directionsUrl(brand)} target="_blank" rel="noreferrer" className={`${button} bg-fg text-surface hover:opacity-90`}>
                <Navigation size={16} aria-hidden /> Get Directions
              </a>
              <a href={telLink(brand)} className={`${button} border border-line/25 hover:border-fg/60`}>
                <Phone size={16} aria-hidden /> Call Now
              </a>
              <a
                href={whatsappLink(brand, `Hi ${brand.legalName}, I saw your showroom online and would like to know more.`)}
                target="_blank"
                rel="noreferrer"
                className={`${button} border border-line/25 hover:border-fg/60`}
              >
                <MessageCircle size={16} aria-hidden /> WhatsApp Us
              </a>
            </div>
            <div className="mt-5">
              <PlaceholderNote show={showroom.placeholders.contact}>demo phone, address and hours — set them in brands.ts</PlaceholderNote>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-7">
            <iframe
              title={`Map showing ${brand.legalName}`}
              src={mapEmbedUrl(brand)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="aspect-[4/3] w-full border border-line/12 grayscale-[35%] lg:aspect-[16/11]"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- closing */

export function ShopClosing({ showroom }: { showroom: Showroom }) {
  const { closing } = showroom;
  return (
    <section aria-labelledby="closing-title" className="relative isolate overflow-hidden bg-night text-ivory">
      <img {...photoProps(closing.photo)} loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" style={{ objectPosition: closing.photo.focus }} />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(var(--night)/0.92),rgb(var(--night)/0.45))]" />
      <div className="mx-auto flex min-h-[80svh] w-full max-w-[1280px] flex-col justify-end px-5 pb-20 pt-40 sm:px-8 md:pb-28">
        <Reveal className="max-w-3xl">
          <h2 id="closing-title" className="font-display text-[clamp(2.6rem,6vw,5.4rem)] leading-[1]">
            {closing.title[0]}
            <br />
            <em className="text-ivory/80">{closing.title[1]}</em>
          </h2>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-ivory/80">{closing.lede}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => scrollToSection(SECTION.collection)}
              className="inline-flex h-12 items-center rounded-full bg-ivory px-7 text-sm font-medium text-night transition-colors hover:bg-white"
            >
              Explore the Collection
            </button>
            <button
              type="button"
              onClick={() => scrollToSection(SECTION.visit)}
              className="inline-flex h-12 items-center rounded-full border border-ivory/35 px-7 text-sm font-medium transition-colors hover:border-ivory/80"
            >
              Visit Our Store
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
