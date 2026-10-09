import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { DEMO_PATH } from '@/data/site';
import { buttonClasses } from '@/components/ui/Button';
import { verifyDemoEmail } from '@/lib/api';

type State = { kind: 'checking' } | { kind: 'ok' } | { kind: 'error'; message: string };

/** Landing page of the link in the confirmation email. */
export function VerifyDemoEmailPage() {
  const token = useSearchParams()[0].get('token') ?? '';
  const [state, setState] = useState<State>({ kind: 'checking' });

  useEffect(() => {
    let live = true;
    verifyDemoEmail(token).then(
      () => live && setState({ kind: 'ok' }),
      (e: unknown) => live && setState({ kind: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' }),
    );
    return () => {
      live = false;
    };
  }, [token]);

  return (
    <section className="bg-grid flex min-h-screen items-center justify-center px-6 py-32">
      <div className="w-full max-w-md rounded-3xl border border-line/10 bg-surface-raised p-10 text-center shadow-[var(--shadow-product)]" role="status">
        {state.kind === 'checking' && (
          <>
            <Loader2 className="mx-auto mb-5 h-12 w-12 animate-spin text-fg-soft" aria-hidden />
            <h1 className="text-2xl font-light text-fg">Confirming your email…</h1>
          </>
        )}
        {state.kind === 'ok' && (
          <>
            <CheckCircle2 className="mx-auto mb-5 h-12 w-12 text-fg-soft" aria-hidden />
            <h1 className="mb-3 text-2xl font-light text-fg">Email confirmed</h1>
            <p className="mb-8 text-sm leading-relaxed text-fg-muted">
              Thank you! Your demo request is with our team and we'll be in touch shortly.
            </p>
            <Link to="/" className={buttonClasses('outline', 'md')}>
              Back to Akruti
            </Link>
          </>
        )}
        {state.kind === 'error' && (
          <>
            <XCircle className="mx-auto mb-5 h-12 w-12 text-red-500" aria-hidden />
            <h1 className="mb-3 text-2xl font-light text-fg">We couldn't confirm that</h1>
            <p className="mb-8 text-sm leading-relaxed text-fg-muted">{state.message}</p>
            <Link to={DEMO_PATH} className={buttonClasses('outline', 'md')}>
              Request a demo
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
