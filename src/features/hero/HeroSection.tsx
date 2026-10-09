import { ArrowRight, Move3d } from 'lucide-react';
import { IMAGES } from '@/data/content';
import { usePointerParallax } from '@/hooks/usePointerParallax';
import { Button } from '@/components/ui/Button';
import { FloatingChip } from './FloatingChip';

export function HeroSection() {
  const { ref, offset, handlers } = usePointerParallax<HTMLElement>();

  return (
    <section
      id="top"
      ref={ref}
      {...handlers}
      className="bg-grid relative flex min-h-[800px] h-screen w-full items-center justify-center overflow-hidden [perspective:1500px]"
    >
      {/* Ambient lighting */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[80vw] w-[80vw] -translate-x-1/2 -translate-y-1/2 animate-pulse-glow rounded-full bg-fg-subtle/10 blur-[150px]"
      />
      <div aria-hidden className="absolute bottom-0 z-10 h-64 w-full bg-gradient-to-t from-surface to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 flex select-none items-center justify-center opacity-[0.03]">
        <span className="whitespace-nowrap text-[15vw] font-bold tracking-tighter">SPATIAL</span>
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-8 px-6 pt-20 lg:grid-cols-12">
        {/* Copy */}
        <div className="z-20 order-2 mt-12 flex flex-col items-start lg:order-1 lg:col-span-5 lg:mt-0">
          <h1 className="mb-6 text-5xl font-light leading-[1.1] tracking-tighter text-fg-subtle md:text-6xl lg:text-7xl">
            Feel the space.
            <br />
            <span className="text-fg">Know the fit.</span>
          </h1>
          <p className="mb-10 max-w-md text-lg font-light leading-relaxed text-fg-muted">
            Transform your furniture catalog into immersive 3D and AR experiences. Build absolute buyer confidence
            before the purchase.
          </p>
          <Button icon={<ArrowRight size={16} aria-hidden />}>Explore Platform</Button>
        </div>

        {/* Showcase */}
        <div className="relative order-1 flex h-[50vh] w-full items-center justify-center lg:order-2 lg:col-span-7 lg:h-[70vh]">
          <div
            className="relative flex aspect-square w-full max-w-2xl items-center justify-center transition-transform duration-700 ease-out [transform-style:preserve-3d] md:aspect-[4/3]"
            style={{ transform: `rotateX(${-offset.y * 15}deg) rotateY(${offset.x * 15}deg) translateZ(50px)` }}
          >
            <div
              aria-hidden
              className="absolute bottom-[10%] h-8 w-3/4 rounded-[100%] bg-black/25 blur-xl dark:bg-black/60 transition-transform duration-700 ease-out"
              style={{ transform: `translate(${-offset.x * 20}px, ${offset.y * 20}px)` }}
            />

            <img
              src={IMAGES.heroSofa}
              alt="Emerald velvet sofa shown in an interactive 3D viewer"
              className="relative z-10 h-auto w-full animate-float-slow rounded-2xl object-cover shadow-product"
              style={{ transform: 'translateZ(80px)' }}
            />

            <FloatingChip
              className="-right-[5%] top-[15%]"
              depth={120}
              icon={
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" />
                </span>
              }
              label="Fabric Match"
              value="Velvet Emerald"
            />
            <FloatingChip
              className="-left-[5%] bottom-[20%]"
              depth={100}
              icon={<Move3d className="text-fg-muted" size={20} aria-hidden />}
              label="Dimensions"
              value={'84"W × 38"D × 34"H'}
            />

            <p className="absolute -bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-2 text-xs uppercase tracking-widest text-fg-subtle opacity-60">
              <Move3d size={14} aria-hidden /> Move mouse to explore
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
