import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DEMO_PATH, SITE } from '@/data/site';
import { buttonClasses } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';

export function CtaSection() {
  return (
    <section id="contact" className="relative overflow-hidden bg-surface-sunken px-6 pb-24 pt-28 text-center md:px-12 md:pt-32">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 select-none text-[20vw] font-bold uppercase tracking-tighter opacity-[0.02]"
      >
        {SITE.name}
      </div>

      <Reveal className="relative z-10 mx-auto max-w-4xl">
        <p className="eyebrow mb-6 text-fg-subtle">
          <span lang="sa">आकृति</span> · Sanskrit for “form”
        </p>
        <h2 className="mb-6 text-4xl font-light leading-tight tracking-tighter text-fg md:text-6xl">
          Give every product
          <br />
          its true form.
        </h2>
        <p className="mx-auto mb-10 max-w-md font-light leading-relaxed text-fg-muted">
          Book a walkthrough and see what your catalogue looks like in 3D and in your buyers’ rooms.
        </p>
        <Link to={DEMO_PATH} className={buttonClasses('primary', 'lg', 'px-10')}>
          Book a demo
          <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </section>
  );
}
