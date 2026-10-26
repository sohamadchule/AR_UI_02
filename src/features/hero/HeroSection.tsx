import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { DEMO_PATH } from '@/data/site';
import { buttonClasses } from '@/components/ui/Button';
import { HeroStage } from './HeroStage';

const PROOF_POINTS = ['No app to install', 'Android and iPhone', 'Opens from a QR code'];

export function HeroSection() {
  return (
    <section id="top" className="bg-grid relative flex min-h-[100svh] w-full items-center overflow-hidden pb-16 pt-28 lg:pt-24">
      {/* Ambient lighting */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[80vw] w-[80vw] -translate-x-1/2 -translate-y-1/2 animate-pulse-glow rounded-full bg-fg-subtle/10 blur-[150px]"
      />
      <div aria-hidden className="pointer-events-none absolute bottom-0 h-40 w-full bg-gradient-to-t from-surface to-transparent" />

      {/* Same 1200 px column as the navbar, so the logo and headline line up. */}
      <div className="relative mx-auto grid w-full max-w-[1200px] items-center gap-12 px-6 md:px-8 lg:grid-cols-12 lg:gap-10">
        <div className="flex flex-col items-start lg:col-span-5">
          <p className="eyebrow mb-6 text-fg-subtle">3D &amp; AR commerce for furniture</p>
          <h1 className="mb-6 text-5xl font-light leading-[1.05] tracking-tighter text-fg-subtle md:text-6xl lg:text-[3.6rem] xl:text-[4rem]">
            Feel the space.
            <br />
            <span className="text-fg">Know the fit.</span>
          </h1>
          <p className="mb-9 max-w-md text-lg font-light leading-relaxed text-fg-muted">
            Turn your furniture catalogue into 3D and AR that buyers can drop into their own room, at true size, before
            they buy.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link to={DEMO_PATH} className={buttonClasses('primary', 'lg')}>
              Book a demo
              <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/experience" className={buttonClasses('outline', 'lg')}>
              Try it on a real piece
            </Link>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-muted">
            {PROOF_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-1.5">
                <Check size={14} aria-hidden className="text-emerald-500" /> {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-7">
          <HeroStage />
        </div>
      </div>
    </section>
  );
}
