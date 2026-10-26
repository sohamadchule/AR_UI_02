import type { Brand, Flagship } from '@/data/brands';

/** The workshop's story beside what the pieces are made of, each with a drawn sample. */
export function CraftSection({ brand, materials }: { brand: Brand; materials: Flagship['materials'] }) {
  return (
    <section aria-labelledby="craft-title" className="border-y border-line/10 bg-surface-raised">
      <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-14 md:py-24">
        <div>
          <p className="eyebrow text-fg-subtle">The workshop · since {brand.about.since}</p>
          <h2 id="craft-title" className="mt-2 font-display text-[clamp(1.8rem,3.8vw,2.7rem)] leading-tight tracking-tight">
            Made by hand, a few streets from where you&apos;ll buy it.
          </h2>
          <p className="mt-4 leading-relaxed text-fg-muted">{brand.about.story[0]}</p>
          <dl className="mt-8 grid grid-cols-3 gap-4">
            {brand.about.facts.map(([value, label]) => (
              <div key={label} className="border-t border-line/15 pt-3">
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="block font-display text-[clamp(1.4rem,3vw,2.1rem)] leading-none text-accent">{value}</span>
                  <span className="mt-1.5 block text-xs text-fg-muted">{label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {materials.map((m) => (
            <li key={m.name} className="overflow-hidden rounded-store border border-line/12 bg-surface">
              <div aria-hidden className="h-24" style={{ background: m.swatch }} />
              <div className="p-4">
                <h3 className="font-semibold">{m.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-fg-muted">{m.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
