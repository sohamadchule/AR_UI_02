import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DEMO_PATH, SITE } from '@/data/site';
import { buttonClasses } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';

export function CtaSection() {
  return (
    <section id="contact" className="relative overflow-hidden bg-surface-sunken px-6 pb-24 pt-32 text-center md:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 select-none text-[20vw] font-bold uppercase tracking-tighter opacity-[0.02]"
      >
        {SITE.name}
      </div>

      <Reveal className="relative z-10 mx-auto max-w-4xl">
        <h2 className="mb-8 text-4xl font-light leading-tight tracking-tighter text-fg md:text-6xl">
          Ready to define the
          <br />
          future of your brand?
        </h2>
        <Link to={DEMO_PATH} className={buttonClasses('primary', 'lg', 'px-10')}>
          Request an Exclusive Demo
          <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-1" />
        </Link>
      </Reveal>
    </section>
  );
}
