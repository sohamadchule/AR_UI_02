import { useId, useState, type FormEvent } from 'react';
import { CheckCircle2, PenLine, Quote, X } from 'lucide-react';
import type { Brand } from '@/data/brands';
import { ApiValidationError, fetchReviews, submitReview } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { cn } from '@/lib/cn';

const input =
  'w-full rounded-store border border-line/15 bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none';
const label = 'mb-1.5 block text-xs uppercase tracking-[0.12em] text-fg-muted';

/** A visitor's review form. Reviews are held for the shop to approve before they appear. */
function ReviewForm({ brand, pieces, onClose }: { brand: Brand; pieces: string[]; onClose: () => void }) {
  const ids = useId();
  const [form, setForm] = useState({ name: '', place: '', piece: '', quote: '', website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [failure, setFailure] = useState('');
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFailure('');
    setState('sending');
    try {
      await submitReview({ brand: brand.slug, ...form });
      setState('sent');
    } catch (err) {
      setState('idle');
      if (err instanceof ApiValidationError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors as Record<string, string>);
      else setFailure(err instanceof Error ? err.message : 'Could not send your review. Please try again.');
    }
  }

  if (state === 'sent') {
    return (
      <div role="status" className="mt-8 flex items-start gap-3 rounded-store border border-line/12 bg-surface-raised p-6">
        <CheckCircle2 size={20} aria-hidden className="mt-0.5 shrink-0 text-accent" />
        <div className="flex-1">
          <p className="font-semibold">Thank you for your review.</p>
          <p className="mt-1 text-sm text-fg-muted">It will appear here once {brand.legalName} has checked it.</p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
          Close
        </button>
      </div>
    );
  }

  const field = (k: 'name' | 'place' | 'piece', text: string, extra: Record<string, unknown> = {}) => (
    <label className="block" htmlFor={`${ids}-${k}`}>
      <span className={label}>{text}</span>
      <input id={`${ids}-${k}`} className={input} value={form[k]} onChange={set(k)} maxLength={80} aria-invalid={Boolean(errors[k])} {...extra} />
      {errors[k] && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{errors[k]}</span>}
    </label>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 rounded-store border border-line/12 bg-surface-raised p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="font-display text-xl">Write a review</p>
        <button type="button" onClick={onClose} aria-label="Close the review form" className="grid h-9 w-9 place-items-center rounded-full text-fg-muted hover:bg-fg/[0.06] hover:text-fg">
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {field('name', 'Your name *', { required: true, autoComplete: 'name' })}
        {field('place', 'City or area', { autoComplete: 'address-level2' })}
        {field('piece', 'Which piece?', { list: `${ids}-pieces` })}
        <datalist id={`${ids}-pieces`}>
          {pieces.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <label className="mt-4 block" htmlFor={`${ids}-quote`}>
        <span className={label}>Your review *</span>
        <textarea
          id={`${ids}-quote`}
          className={cn(input, 'min-h-[110px]')}
          value={form.quote}
          onChange={set('quote')}
          maxLength={600}
          required
          aria-invalid={Boolean(errors.quote)}
          placeholder="How did it fit your room? How was the shop?"
        />
        <span className="mt-1 flex justify-between text-xs">
          <span className="text-red-600 dark:text-red-400">{errors.quote}</span>
          <span className="text-fg-subtle tabular-nums">{form.quote.length}/600</span>
        </span>
      </label>
      {/* Honeypot: hidden from people, filled in by bots. */}
      <input type="text" name="website" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {failure && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {failure}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={state === 'sending'}
          className="h-11 rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink transition-[filter] hover:brightness-110 disabled:opacity-60"
        >
          {state === 'sending' ? 'Sending…' : 'Send review'}
        </button>
        <span className="text-xs text-fg-subtle">Reviews appear after the shop has checked them.</span>
      </div>
    </form>
  );
}

/** What buyers said: approved reviews from the database, and a form to add one. */
export function ReviewsSection({ brand, pieces }: { brand: Brand; pieces: string[] }) {
  const reviews = useAsync(() => fetchReviews(brand.slug), `reviews-${brand.slug}`);
  const [writing, setWriting] = useState(false);
  const list = reviews.status === 'ready' ? reviews.data : [];

  return (
    <section aria-labelledby="reviews-title" className="mx-auto w-full max-w-[1180px] px-4 py-16 sm:px-6 md:py-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-fg-subtle">In their homes</p>
          <h2 id="reviews-title" className="mt-2 font-display text-[clamp(1.8rem,3.8vw,2.7rem)] leading-tight tracking-tight">
            Placed first. Then ordered.
          </h2>
        </div>
        {!writing && (
          <button
            type="button"
            onClick={() => setWriting(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-line/20 px-5 text-sm font-semibold transition-colors hover:border-fg/40"
          >
            <PenLine size={15} aria-hidden /> Write a review
          </button>
        )}
      </div>

      {writing && <ReviewForm brand={brand} pieces={pieces} onClose={() => setWriting(false)} />}

      {reviews.status === 'ready' && list.length === 0 && !writing && (
        <p className="mt-10 text-sm text-fg-muted">No reviews yet. Bought from us? Be the first to share how it fits your home.</p>
      )}

      {list.length > 0 && (
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {list.map((r) => (
            <li key={r.id} className="flex flex-col gap-5 rounded-store border border-line/12 bg-surface-raised p-6">
              <Quote size={22} aria-hidden className="text-accent" />
              <blockquote className="flex-1 font-display text-xl leading-snug">{r.quote}</blockquote>
              <footer className="flex items-end justify-between gap-3 border-t border-line/10 pt-4 text-sm">
                <span>
                  <span className="block font-semibold">{r.name}</span>
                  {r.place && <span className="text-fg-subtle">{r.place}</span>}
                </span>
                {r.piece && <span className="rounded-full border border-line/15 px-2.5 py-1 text-xs text-fg-muted">{r.piece}</span>}
              </footer>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
