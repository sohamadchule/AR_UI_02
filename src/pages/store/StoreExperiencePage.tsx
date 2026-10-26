import { useOutletContext } from 'react-router-dom';
import type { Brand } from '@/data/brands';
import { ExperienceBrowser } from '@/features/experience/ExperienceBrowser';

/** The Akruti experience — live 3D, colours, true size, AR by QR — in the shop's own brand kit. */
export function StoreExperiencePage() {
  const brand = useOutletContext<Brand>();

  return (
    <section aria-label="Experience" className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-10 sm:px-6 md:pt-16">
      <p className="eyebrow text-fg-subtle">3D &amp; AR at {brand.legalName}</p>
      <h1 className="mt-3 max-w-[20ch] font-display text-[clamp(2.2rem,6vw,3.7rem)] leading-[1.05] tracking-tight text-balance">
        Experience it <em className="not-italic text-accent">before</em> you buy it.
      </h1>
      <p className="mb-12 mt-4 max-w-[52ch] text-fg-muted">
        Pick any piece from our showroom, turn it around and change its colour. Then scan the code to place it in your
        own room, at real size.
      </p>
      <ExperienceBrowser />
    </section>
  );
}
