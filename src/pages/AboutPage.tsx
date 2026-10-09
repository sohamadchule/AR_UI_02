import { PROCESS, PRINCIPLES } from '@/data/about';
import { Badge } from '@/components/ui/Badge';
import { Reveal } from '@/components/ui/Reveal';
import { CtaSection } from '@/features/cta/CtaSection';

export function AboutPage() {
  return (
    <>
      <section className="bg-grid relative overflow-hidden px-6 pb-24 pt-40 md:px-12 md:pt-48">
        <div className="mx-auto max-w-6xl">
          <Badge className="mb-8">About Akruti</Badge>
          <h1 className="max-w-4xl text-5xl font-light leading-[1.1] tracking-tighter text-fg md:text-7xl">
            We help people <span className="text-fg-subtle">see it in their space</span> before they buy.
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-fg-muted">
            Akruti is a spatial commerce platform for furniture brands. We turn flat catalog imagery into interactive 3D
            and augmented-reality experiences, so customers can place, configure and judge a piece with certainty.
          </p>
        </div>
      </section>

      <section className="border-y border-line/10 bg-surface-raised px-6 py-28 md:px-12">
        <div className="mx-auto grid max-w-6xl gap-16 md:grid-cols-2">
          <Reveal>
            <p className="eyebrow mb-6 text-fg-subtle">Our mission</p>
            <h2 className="text-4xl font-light leading-tight tracking-tighter text-fg md:text-5xl">
              Replace guesswork with certainty.
            </h2>
          </Reveal>
          <Reveal threshold={0.2} className="space-y-6 font-light leading-relaxed text-fg-muted">
            <p>
              Furniture is one of the hardest things to buy online. Scale, color and texture are difficult to judge from
              a photograph, which leads to hesitation, abandoned carts and costly returns.
            </p>
            <p>
              We close that gap. Brands publish their products once, and shoppers can rotate them, change the finish and
              view them at true size in their own room.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-surface px-6 py-28 md:px-12">
        <Reveal className="mx-auto max-w-6xl">
          <p className="eyebrow mb-6 text-fg-subtle">Principles</p>
          <h2 className="mb-16 max-w-2xl text-4xl font-light leading-tight tracking-tighter text-fg md:text-5xl">
            What we hold ourselves to.
          </h2>
          <ul className="grid gap-8 md:grid-cols-3">
            {PRINCIPLES.map((item) => (
              <li key={item.title} className="glass-panel rounded-2xl p-8">
                <h3 className="mb-4 text-xl font-medium tracking-tight text-fg">{item.title}</h3>
                <p className="text-sm font-light leading-relaxed text-fg-muted">{item.description}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section className="border-t border-line/10 bg-surface-raised px-6 py-28 md:px-12">
        <Reveal className="mx-auto max-w-6xl">
          <p className="eyebrow mb-6 text-fg-subtle">How it works</p>
          <h2 className="mb-16 max-w-2xl text-4xl font-light leading-tight tracking-tighter text-fg md:text-5xl">
            From catalog to experience in three steps.
          </h2>
          <ol className="grid gap-12 md:grid-cols-3">
            {PROCESS.map((item) => (
              <li key={item.step} className="border-t border-line/15 pt-6">
                <span className="text-sm font-light tracking-widest text-fg-subtle">{item.step}</span>
                <h3 className="mb-3 mt-4 text-2xl font-light tracking-tight text-fg">{item.title}</h3>
                <p className="text-sm font-light leading-relaxed text-fg-muted">{item.description}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      <CtaSection />
    </>
  );
}
