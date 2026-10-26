import { ArrowDown, MapPin } from 'lucide-react';
import type { Brand } from '@/data/brands';
import { SECTION, photoProps, type Showroom } from '@/data/showrooms';
import { PlaceholderNote } from './PlaceholderNote';
import { scrollToSection } from './scroll';

/**
 * The first screen: a full-bleed photograph of the showroom, settling slowly like a
 * camera finishing its move, with the shop's welcome over a dark gradient.
 */
export function ShopHero({ brand, showroom }: { brand: Brand; showroom: Showroom }) {
  const { hero } = showroom;

  return (
    <section id={SECTION.top} aria-label={`Welcome to ${brand.legalName}`} className="relative isolate h-[100svh] min-h-[600px] overflow-hidden bg-night text-ivory">
      <img
        {...photoProps(hero.photo)}
        // The first thing anyone sees: fetch it before anything else (lower-case: React 18 has no fetchPriority prop).
        {...{ fetchpriority: 'high' }}
        decoding="async"
        className="absolute inset-0 -z-20 h-full w-full animate-settle object-cover"
        style={{ transformOrigin: hero.photo.focus ?? '50% 50%' }}
      />
      {/* Darker at the foot and the left, where the words sit; the photo stays visible top-right. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(var(--night)/0.92),rgb(var(--night)/0.35)_55%,rgb(var(--night)/0.25))]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(var(--night)/0.55),transparent_65%)]" />

      <div className="mx-auto flex h-full w-full max-w-[1280px] flex-col justify-end px-5 pb-16 sm:px-8 md:pb-24">
        <div className="max-w-3xl">
          <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.32em] text-ivory/75">{hero.eyebrow}</p>
          <h1 className="font-display text-[clamp(2.9rem,7.4vw,6.4rem)] leading-[0.98] tracking-[-0.01em]">
            {hero.title[0]}
            <br />
            <em className="text-ivory/80">{hero.title[1]}</em>
          </h1>
          <p className="mt-7 max-w-[44ch] text-base leading-relaxed text-ivory/80 md:text-lg">{hero.lede}</p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => scrollToSection(SECTION.showroom)}
              className="group inline-flex h-12 items-center gap-3 rounded-full bg-ivory px-7 text-sm font-medium text-night transition-colors hover:bg-white"
            >
              Explore the Showroom
              <ArrowDown size={16} aria-hidden className="transition-transform duration-500 group-hover:translate-y-0.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollToSection(SECTION.collection)}
              className="inline-flex h-12 items-center rounded-full border border-ivory/35 px-7 text-sm font-medium text-ivory transition-colors hover:border-ivory/80"
            >
              Discover Our Collection
            </button>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-ivory/15 pt-5 text-xs uppercase tracking-[0.2em] text-ivory/65">
          <span className="flex items-center gap-2">
            <MapPin size={14} aria-hidden /> {brand.city}
          </span>
          <PlaceholderNote show={showroom.placeholders.photos} tone="light">
            Stock photo — replace with the shop's own
          </PlaceholderNote>
          <span className="hidden sm:inline">Scroll to step inside</span>
        </div>
      </div>
    </section>
  );
}
