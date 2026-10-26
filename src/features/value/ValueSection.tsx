import { Boxes, PackageCheck, ThumbsUp } from 'lucide-react';
import { VALUE_PROPS } from '@/data/content';
import { Reveal } from '@/components/ui/Reveal';

const ICONS = [PackageCheck, ThumbsUp, Boxes];

export function ValueSection() {
  return (
    <section id="value" className="bg-surface px-6 py-24 md:px-12 md:py-32">
      <Reveal className="mx-auto max-w-6xl">
        <h2 className="mb-16 text-center text-3xl font-light tracking-tighter text-fg md:mb-20 md:text-5xl">
          Built for modern
          <br />
          furniture brands.
        </h2>

        <ul className="grid gap-6 md:grid-cols-3 md:gap-8">
          {VALUE_PROPS.map((prop, i) => {
            const Icon = ICONS[i];
            return (
              <li
                key={prop.title}
                className="glass-panel rounded-2xl p-8 transition-colors duration-500 hover:bg-fg/5"
              >
                <span
                  aria-hidden
                  className="mb-6 flex h-11 w-11 items-center justify-center rounded-full bg-fg/10 text-fg-soft"
                >
                  <Icon size={20} />
                </span>
                <h3 className="mb-4 text-xl font-medium tracking-tight text-fg">{prop.title}</h3>
                <p className="text-sm font-light leading-relaxed text-fg-muted">{prop.description}</p>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
}
