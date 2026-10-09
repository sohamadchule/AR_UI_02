import type { ReactNode } from 'react';
import { Boxes, Gauge, Layers, MousePointerClick, QrCode, RotateCcw, Smartphone, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Reveal } from '@/components/ui/Reveal';
import { DemoRequestForm } from '@/features/demo/DemoRequestForm';

interface Point {
  icon: ReactNode;
  title: string;
  text: string;
}

const icon = (Icon: typeof Boxes) => <Icon size={18} aria-hidden />;

const WHY: readonly Point[] = [
  {
    icon: icon(RotateCcw),
    title: 'Fewer returns',
    text: 'Shoppers see the real size and look in their own room before they buy, so "it didn\'t fit" stops being a surprise.',
  },
  {
    icon: icon(TrendingUp),
    title: 'Higher conversion',
    text: 'Interactive 3D keeps people on the page longer and gives them the confidence to click Buy.',
  },
  {
    icon: icon(Layers),
    title: 'One model, everywhere',
    text: 'A single 3D asset powers your web viewer, AR placement and every configuration, with no re-shoots.',
  },
];

const SEE: readonly Point[] = [
  { icon: icon(Boxes), title: 'Live 3D viewer', text: 'Rotate and inspect your products at true scale.' },
  { icon: icon(Smartphone), title: 'AR in the room', text: 'Place a piece in a real space from a phone, no app.' },
  { icon: icon(QrCode), title: 'QR to experience', text: 'Turn a printed tag or catalog page into a live view.' },
  { icon: icon(MousePointerClick), title: 'Configurator', text: 'Swap fabrics and finishes instantly.' },
];

const STEPS = ['Send the form and confirm your email', 'We reach out to find a time that suits you', 'A tailored walkthrough built around your catalog'];

function PointList({ points }: { points: readonly Point[] }) {
  return (
    <ul className="space-y-6">
      {points.map((p) => (
        <li key={p.title} className="flex gap-4">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line/15 bg-surface-raised text-fg-soft">
            {p.icon}
          </span>
          <div>
            <h3 className="text-base font-medium text-fg">{p.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{p.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Side pitch on desktop: faded and softly blurred behind the card, like the page under a popup,
 * so it teases the eye; it sharpens when hovered or tabbed into. Plain and readable on phones.
 */
function Teaser({ children }: { children: ReactNode }) {
  return (
    <div className="transition-[opacity,filter] duration-500 lg:select-none lg:opacity-[0.55] lg:blur-[0.75px] lg:hover:select-auto lg:hover:opacity-100 lg:hover:blur-0 lg:focus-within:opacity-100 lg:focus-within:blur-0">
      {children}
    </div>
  );
}

export function RequestDemoPage() {
  return (
    <section className="bg-grid relative overflow-hidden px-6 pb-24 pt-32 md:px-12 md:pt-40">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <Badge className="mb-6" icon={<Gauge size={14} aria-hidden />}>
            Exclusive demo
          </Badge>
          <h1 className="text-4xl font-light leading-[1.1] tracking-tighter text-fg md:text-6xl">
            See your products <span className="text-fg-subtle">come alive</span> in 3D and AR.
          </h1>
        </div>

        <div className="grid items-start gap-12 lg:grid-cols-[1fr_minmax(0,32rem)_1fr] lg:gap-10 xl:gap-14">
          {/* The popup-style card: first on phones, centred and lifted between the two pitches on desktop. */}
          <Reveal className="relative z-10 w-full rounded-3xl border border-line/15 bg-surface-raised p-8 shadow-[0_40px_90px_-20px_rgb(0_0_0/0.45)] ring-1 ring-line/5 md:p-10 lg:col-start-2 lg:row-start-1">
            <DemoRequestForm />
          </Reveal>

          <Reveal className="lg:col-start-1 lg:row-start-1 lg:pt-10">
            <Teaser>
              <p className="mb-6 text-xs uppercase tracking-[0.2em] text-fg-subtle">Why Akruti</p>
              <h2 className="mb-8 text-2xl font-light leading-snug text-fg">Sell with certainty, not guesswork.</h2>
              <PointList points={WHY} />
            </Teaser>
          </Reveal>

          <Reveal className="lg:col-start-3 lg:row-start-1 lg:pt-10">
            <Teaser>
              <p className="mb-6 text-xs uppercase tracking-[0.2em] text-fg-subtle">In your demo</p>
              <PointList points={SEE} />
              <div className="mt-10 rounded-2xl border border-line/10 bg-surface-raised p-6">
                <p className="mb-4 text-xs uppercase tracking-[0.2em] text-fg-subtle">What happens next</p>
                <ol className="space-y-3">
                  {STEPS.map((step, i) => (
                    <li key={step} className="flex gap-3 text-sm text-fg-muted">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fg text-xs text-surface">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </Teaser>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
