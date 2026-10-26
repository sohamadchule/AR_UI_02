import { useEffect, useState, type CSSProperties } from 'react';
import { IMAGES, type Swatch } from '@/data/content';

interface ChairViewerProps {
  swatch: Swatch;
  alt: string;
}

const MASK: CSSProperties = {
  WebkitMaskImage: `url(${IMAGES.configuratorChairMask})`,
  maskImage: `url(${IMAGES.configuratorChairMask})`,
  // Must crop exactly like the photo's `object-cover`, or the tint drifts off the
  // upholstery whenever the box isn't 4:5 (e.g. on narrow phones).
  WebkitMaskSize: 'cover',
  maskSize: 'cover',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
};

/** One fully coloured copy of the upholstery: a brightness-adjusted fabric plus a blended tint. */
function FabricLayer({ swatch, animate }: { swatch: Swatch; animate: boolean }) {
  return (
    <div className={`absolute inset-0 isolate ${animate ? 'animate-color-spread' : ''}`}>
      <img
        src={IMAGES.configuratorChair}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        style={{ ...MASK, filter: `brightness(${swatch.brightness})` }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ ...MASK, backgroundColor: swatch.tint, mixBlendMode: 'color' }}
      />
    </div>
  );
}

/**
 * Recolours only the chair upholstery. Layers, bottom to top:
 *  1. the untouched photo,
 *  2. the previous colour, held in place,
 *  3. the new colour, which spreads out across the seat from its centre.
 * The wood frame and backdrop are outside the mask and never change.
 */
export function ChairViewer({ swatch, alt }: ChairViewerProps) {
  const [layers, setLayers] = useState({ from: swatch, to: swatch });

  useEffect(() => {
    setLayers((current) => (current.to.id === swatch.id ? current : { from: current.to, to: swatch }));
  }, [swatch]);

  const transitioning = layers.from.id !== layers.to.id;

  return (
    <div className="relative isolate aspect-[4/5] h-full overflow-hidden rounded-xl">
      <img src={IMAGES.configuratorChair} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      <FabricLayer swatch={layers.from} animate={false} />
      <FabricLayer key={layers.to.id} swatch={layers.to} animate={transitioning} />
    </div>
  );
}
