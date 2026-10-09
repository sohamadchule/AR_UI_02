import { Link, useParams } from 'react-router-dom';
import { Cuboid } from 'lucide-react';
import { fetchVariant } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { SITE } from '@/data/site';
import { ModelStage } from '@/features/experience/ModelStage';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

/**
 * Public, mobile-first product page: the destination of every QR code.
 * Deliberately standalone (no site navigation) so the model gets the whole screen.
 */
export function ViewPage() {
  const { variantId = '' } = useParams();
  const result = useAsync(() => fetchVariant(variantId), variantId);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10 pt-5">
      <header className="mb-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-fg" aria-label={`${SITE.name} home`}>
          <Cuboid className="h-5 w-5 text-fg-soft" aria-hidden />
          <span className="text-sm font-light uppercase tracking-[0.2em]">{SITE.name}</span>
        </Link>
        <ThemeToggle />
      </header>

      {result.status === 'loading' && (
        <p role="status" className="mt-24 text-center text-sm text-fg-muted">
          Loading…
        </p>
      )}

      {result.status === 'error' && (
        <div role="alert" className="mt-24 text-center">
          <h1 className="text-xl font-light text-fg">Model not found</h1>
          <p className="mt-2 text-sm text-fg-muted">This link may be out of date.</p>
          <Link to="/experience" className="mt-6 inline-block text-sm text-fg-soft underline underline-offset-4">
            Browse all models
          </Link>
        </div>
      )}

      {result.status === 'ready' && (
        <>
          <h1 className="text-2xl font-light tracking-tight text-fg">{result.data.product.name}</h1>
          <p className="mb-4 text-sm text-fg-muted">
            {result.data.name}
            {result.data.material ? ` · ${result.data.material}` : ''}
          </p>
          <ModelStage variant={result.data} className="min-h-[58vh] flex-1" />
          <p className="pt-3 text-center text-xs uppercase tracking-widest text-fg-subtle">Rotate · Zoom · Explore</p>
          {result.data.product.description && (
            <p className="pt-4 text-sm leading-relaxed text-fg-muted">{result.data.product.description}</p>
          )}
        </>
      )}
    </div>
  );
}
