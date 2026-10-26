import { QrCode, Smartphone, Upload } from 'lucide-react';
import { STEPS } from '@/data/content';
import { Reveal } from '@/components/ui/Reveal';

const ICONS = [Upload, QrCode, Smartphone];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-y border-line/10 bg-surface-raised px-6 py-24 md:px-12 md:py-32">
      <Reveal className="mx-auto max-w-6xl">
        <p className="eyebrow mb-6 text-fg-subtle">How it works</p>
        <h2 className="mb-16 max-w-2xl text-4xl font-light leading-tight tracking-tighter text-fg md:text-5xl">
          From catalogue to living room
          <span className="text-fg-subtle"> in three steps.</span>
        </h2>

        <div className="relative">
          {/* The thread joining the three steps on wide screens. */}
          <div aria-hidden className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-line/15 to-transparent md:block" />
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, i) => {
              const Icon = ICONS[i];
              return (
                <li key={step.title} className="relative">
                  <span className="relative mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-line/10 bg-surface text-fg shadow-sm">
                    <Icon size={20} aria-hidden />
                  </span>
                  <p className="eyebrow mb-2 text-fg-subtle">Step {i + 1}</p>
                  <h3 className="mb-3 text-xl font-medium tracking-tight text-fg">{step.title}</h3>
                  <p className="max-w-xs text-sm font-light leading-relaxed text-fg-muted">{step.description}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </Reveal>
    </section>
  );
}
