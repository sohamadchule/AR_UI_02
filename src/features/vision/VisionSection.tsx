import { Reveal } from '@/components/ui/Reveal';

export function VisionSection() {
  return (
    <section id="vision" className="relative overflow-hidden bg-surface px-6 py-24 md:px-12 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-16 md:grid-cols-2 md:gap-8">
        <Reveal>
          <p className="eyebrow mb-6 text-fg-subtle">The Uncertainty</p>
          <h2 className="mb-6 text-4xl font-light leading-tight tracking-tighter text-fg-soft md:text-5xl">
            “Will it fit?
            <br />
            How will it look?”
          </h2>
          <p className="font-light leading-relaxed text-fg-muted">
            Traditional flat images leave customers guessing. They hesitate, abandon carts, or return items that
            don&apos;t match their space.
          </p>
        </Reveal>

        <Reveal threshold={0.2} className="border-l border-line/10 pl-8 md:pl-16">
          <p className="eyebrow mb-6 flex items-center gap-2 text-fg-soft">
            <span className="h-2 w-2 rounded-full bg-fg-soft" aria-hidden /> The Akruti Standard
          </p>
          <h2 className="mb-6 text-4xl font-light leading-tight tracking-tighter text-fg md:text-5xl">
            Total spatial
            <br />
            confidence.
          </h2>
          <p className="font-light leading-relaxed text-fg-muted">
            We replace imagination with reality. Let your customers place, configure, and experience your products in
            their exact environment before they buy.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
