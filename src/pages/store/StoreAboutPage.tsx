import { useOutletContext } from 'react-router-dom';
import { Clock, Mail, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react';
import { telLink, whatsappLink, type Brand } from '@/data/brands';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const mapEmbed = (query: string) => `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;
const directions = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/** The shop's story, then every way to reach it: call, WhatsApp, email, and a map to the showroom. */
export function StoreAboutPage() {
  const brand = useOutletContext<Brand>();
  useDocumentTitle(`About & contact — ${brand.legalName}`);
  const { about, contact } = brand;

  const reach = [
    { icon: Phone, label: 'Call the shop', value: contact.phone, href: telLink(brand) },
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      value: 'Chat with us',
      href: whatsappLink(brand, `Hi ${brand.legalName}, I have a question about your furniture.`),
      external: true,
    },
    { icon: Mail, label: 'Email', value: contact.email, href: `mailto:${contact.email}` },
  ];

  return (
    <>
      <section className="border-b border-line/10 bg-surface-raised">
        <div className="mx-auto w-full max-w-[1180px] px-4 py-12 sm:px-6 md:py-20">
          <p className="eyebrow text-fg-subtle">
            About us · {brand.city} · Since {about.since}
          </p>
          <h1 className="mt-3 store-mark text-[clamp(2.4rem,7vw,4.4rem)] leading-none">
            {brand.mark[0]} <span className="text-accent">{brand.mark[1]}</span>
          </h1>

          <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-16">
            <div className="space-y-4 text-lg leading-relaxed text-fg-soft">
              {about.story.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <dl className="grid grid-cols-3 gap-4 self-start md:grid-cols-1 md:gap-6">
              {about.facts.map(([value, label]) => (
                <div key={label} className="border-t border-line/15 pt-3">
                  <dt className="sr-only">{label}</dt>
                  <dd>
                    <span className="block font-display text-[clamp(1.6rem,4vw,2.6rem)] leading-none text-accent">{value}</span>
                    <span className="mt-1.5 block text-sm text-fg-muted">{label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto w-full max-w-[1180px] scroll-mt-16 px-4 py-12 sm:px-6 md:py-20">
        <p className="eyebrow text-fg-subtle">Contact</p>
        <h2 className="mt-2 font-display text-[clamp(1.7rem,3.6vw,2.5rem)] tracking-tight">Visit the showroom, or just ask.</h2>

        <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-3">
            {reach.map(({ icon: Icon, label, value, href, external }) => (
              <a
                key={label}
                href={href}
                {...(external && { target: '_blank', rel: 'noreferrer' })}
                className="flex items-center gap-4 rounded-store border border-line/12 bg-surface-raised p-4 transition-colors hover:border-accent/50"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                  <Icon size={18} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs uppercase tracking-[0.12em] text-fg-subtle">{label}</span>
                  <span className="block truncate font-semibold">{value}</span>
                </span>
              </a>
            ))}

            <div className="mt-2 grid gap-5 rounded-store border border-line/12 p-5 sm:grid-cols-2">
              <div className="flex gap-3">
                <MapPin size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
                <address className="not-italic text-sm leading-relaxed text-fg-soft">
                  {brand.legalName}
                  {contact.address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
              <div className="flex gap-3">
                <Clock size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
                <ul className="text-sm leading-relaxed text-fg-soft">
                  {contact.hours.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <iframe
              title={`Map showing ${brand.legalName}, ${contact.mapQuery}`}
              src={mapEmbed(contact.mapQuery)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="aspect-[4/3] w-full rounded-store border border-line/12 bg-surface-sunken md:aspect-auto md:flex-1"
            />
            <a
              href={directions(contact.mapQuery)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 self-start text-sm font-semibold text-accent underline-offset-4 hover:underline"
            >
              <Navigation size={15} aria-hidden /> Get directions
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
