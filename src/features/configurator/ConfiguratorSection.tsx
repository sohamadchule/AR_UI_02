import { useState } from 'react';
import { Layers, ScanLine } from 'lucide-react';
import { IMAGES, SWATCHES } from '@/data/content';
import { fetchVariants, qrUrl } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { Reveal } from '@/components/ui/Reveal';
import { ChairViewer } from './ChairViewer';
import { SwatchPicker } from './SwatchPicker';

/** The catalogue piece the QR opens in AR: the closest match to the chair in the photo. */
const AR_CHAIR = 'upholstered-dining-chair';

/** Desktop only: hands the chair to the visitor's phone. Hidden until the catalogue has it. */
function ChairQr() {
  const catalog = useAsync(fetchVariants, 'variants');
  if (catalog.status !== 'ready') return null;
  const chairs = catalog.data.filter((v) => v.product.slug === AR_CHAIR);
  const variant = chairs.find((v) => v.isDefault) ?? chairs[0];
  if (!variant) return null;

  return (
    <div className="mt-10 hidden w-fit items-center gap-3 rounded-2xl border border-line/10 bg-surface p-2 pr-4 lg:flex">
      <img
        src={qrUrl(variant.id)}
        alt={`QR code: open the ${variant.product.name} on your phone`}
        width={72}
        height={72}
        className="h-[72px] w-[72px] rounded-lg bg-white p-1"
      />
      <div>
        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-fg-muted">
          <ScanLine size={12} aria-hidden /> Scan with your phone
        </p>
        <p className="mt-1 max-w-[140px] text-sm leading-snug text-fg">Place it in your room, at real size.</p>
      </div>
    </div>
  );
}

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
          <ChairQr />
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

