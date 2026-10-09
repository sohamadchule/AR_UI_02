import { VALUE_PROPS } from '@/data/content';
import { Reveal } from '@/components/ui/Reveal';

export function ValueSection() {
  return (
    <section id="value" className="bg-surface px-6 py-32 md:px-12">
      <Reveal className="mx-auto max-w-6xl">
        <h2 className="mb-20 text-center text-3xl font-light tracking-tighter text-fg md:text-5xl">
          Built for modern
          <br />
          furniture brands.
        </h2>

        <ul className="grid gap-8 md:grid-cols-3">
          {VALUE_PROPS.map((prop, i) => (
            <li
              key={prop.title}
              className="glass-panel rounded-2xl p-8 transition-colors duration-500 hover:bg-fg/5"
            >
              <span
                aria-hidden
                className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-fg/10 font-light text-fg-soft"
              >
                {i + 1}
              </span>
              <h3 className="mb-4 text-xl font-medium tracking-tight text-fg">{prop.title}</h3>
              <p className="text-sm font-light leading-relaxed text-fg-muted">{prop.description}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
