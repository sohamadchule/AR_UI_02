import { useState } from 'react';
import { Layers } from 'lucide-react';
import { IMAGES, SWATCHES } from '@/data/content';
import { Reveal } from '@/components/ui/Reveal';
import { ChairViewer } from './ChairViewer';
import { SwatchPicker } from './SwatchPicker';

export function ConfiguratorSection() {
  const [activeId, setActiveId] = useState(SWATCHES[0].id);
  const active = SWATCHES.find((s) => s.id === activeId) ?? SWATCHES[0];

  return (
    <section id="experience" className="relative border-y border-line/10 bg-surface-raised px-6 py-32 md:px-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-16 lg:flex-row">
        <Reveal className="lg:w-1/3">
          <p className="eyebrow mb-6 flex items-center gap-2 text-fg-muted">
            <Layers size={14} aria-hidden /> Live Configuration
          </p>
          <h2 className="mb-6 text-4xl font-light leading-tight tracking-tighter text-fg md:text-5xl">
            Endless variations.
            <br />
            Zero friction.
          </h2>
          <p className="mb-10 font-light leading-relaxed text-fg-muted">
            Digitize your entire catalog instantly. Allow users to swap colors, fabrics, and finishes in real-time,
            generating photorealistic visualizations on the fly.
          </p>
          <SwatchPicker swatches={SWATCHES} activeId={activeId} onChange={setActiveId} />
        </Reveal>

        <div className="glass-panel relative flex h-[560px] w-full items-center justify-center overflow-hidden rounded-3xl md:h-[660px] lg:w-2/3">
          {/* Blurred copy of the photo fills the sides around the portrait viewer. */}
          <img
            src={IMAGES.configuratorChair}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-3xl"
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-tr from-black/20 to-transparent dark:from-black/40" />
          <ChairViewer swatch={active} alt={`Upholstered chair in ${active.name}`} />
          <div className="absolute inset-x-6 top-6 z-20 flex items-center justify-between">
            <span className="rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[10px] uppercase tracking-widest text-stone-200 backdrop-blur-md">
              High-Fidelity Render
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

