import { Armchair, Hammer, ScanLine, Truck, type LucideIcon } from 'lucide-react';
import type { Flagship } from '@/data/brands';
import { cn } from '@/lib/cn';

/** One icon per step, in the order the brand lists them. */
const ICONS: LucideIcon[] = [Armchair, ScanLine, Hammer, Truck];
/** The step the shop is proudest of: seeing it at home before it is made. */
const HIGHLIGHT = 1;

/** Order to doorstep, as a numbered row of steps with how long each takes. */
export function ProcessSection({ steps }: { steps: Flagship['process'] }) {
  return (
    <section aria-labelledby="process-title" className="mx-auto w-full max-w-[1180px] px-4 py-16 sm:px-6 md:py-24">
      <p className="eyebrow text-fg-subtle">How a piece is made</p>
      <h2 id="process-title" className="mt-2 max-w-[22ch] font-display text-[clamp(1.8rem,3.8vw,2.7rem)] leading-tight tracking-tight">
        From our floor to yours, in four steps.
      </h2>

      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([title, detail, duration], i) => {
          const Icon = ICONS[i % ICONS.length];
          const highlight = i === HIGHLIGHT;
          return (
            <li
              key={title}
              className={cn(
                'relative flex flex-col gap-3 rounded-store border p-5',
                highlight ? 'border-accent/50 bg-accent/[0.07]' : 'border-line/12 bg-surface-raised',
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('grid h-10 w-10 place-items-center rounded-full', highlight ? 'bg-accent text-accent-ink' : 'bg-fg/[0.06] text-fg-soft')}>
                  <Icon size={18} aria-hidden />
                </span>
                <span className="font-display text-3xl leading-none text-fg/15">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="flex-1 text-sm leading-relaxed text-fg-muted">{detail}</p>
              <span className={cn('self-start rounded-full px-2.5 py-1 text-xs font-semibold', highlight ? 'bg-accent text-accent-ink' : 'bg-fg/[0.06] text-fg-soft')}>
                {duration}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
