import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { fetchVariants, viewPath } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { ModelStage } from '@/features/experience/ModelStage';
import { QrPanel } from '@/features/experience/QrPanel';
import { VariantList } from '@/features/experience/VariantList';

const meters = (v: number) => `${v.toFixed(2)} m`;

export function ExperiencePage() {
  const catalog = useAsync(fetchVariants, 'variants');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <section aria-label="Experience" className="px-6 pb-24 pt-32 md:px-12 md:pt-40">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-4 max-w-3xl text-4xl font-light leading-tight tracking-tighter text-fg-subtle md:text-6xl">
          Experience it
          <br />
          <span className="text-fg">before you buy it.</span>
        </h1>
        <p className="mb-14 max-w-xl font-light leading-relaxed text-fg-muted">
          See it in 3D. Place it in your room. Pick a piece, rotate it, then view it at real size in your space with
          AR, or scan the code on your phone.
        </p>

        {catalog.status === 'loading' && (
          <p role="status" className="text-sm text-fg-muted">
            Loading models…
          </p>
        )}

        {catalog.status === 'error' && (
          <p role="alert" className="rounded-2xl border border-line/15 p-6 text-sm text-fg-muted">
            Couldn&apos;t load the model catalog. Make sure the API server is running (<code>npm run dev:all</code>).
          </p>
        )}

        {catalog.status === 'ready' && catalog.data.length === 0 && (
          <p className="text-sm text-fg-muted">No models are published yet.</p>
        )}

        {catalog.status === 'ready' && catalog.data.length > 0 && (() => {
          const variants = catalog.data;
          const active = variants.find((v) => v.id === selectedId) ?? variants.find((v) => v.isDefault) ?? variants[0];
          const size = active.model.dimensionsM;

          return (
            <div className="grid gap-10 lg:grid-cols-12">
              <div className="space-y-10 lg:col-span-7">
                <ModelStage variant={active} className="h-[460px] md:h-[600px]" />

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h2 className="text-2xl font-light tracking-tight text-fg">{active.product.name}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-fg-muted">{active.product.description}</p>
                    <Link
                      to={viewPath(active.id)}
                      className="mt-4 inline-flex items-center gap-1 text-sm text-fg-soft transition-colors hover:text-fg"
                    >
                      Open public page <ArrowUpRight size={14} aria-hidden />
                    </Link>
                  </div>
                  {size && (
                    <dl className="grid grid-cols-3 gap-4 text-sm">
                      {[
                        ['Width', size.width],
                        ['Height', size.height],
                        ['Depth', size.depth],
                      ].map(([label, value]) => (
                        <div key={label as string}>
                          <dt className="eyebrow text-fg-subtle">{label}</dt>
                          <dd className="mt-1 text-fg">{meters(value as number)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>

              <div className="space-y-10 lg:col-span-5">
                <VariantList variants={variants} activeId={active.id} onSelect={setSelectedId} />
                <div className="rounded-3xl border border-line/10 p-6">
                  <QrPanel variant={active} />
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </section>
  );
}
