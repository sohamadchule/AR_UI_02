import { Quote } from 'lucide-react';
import type { Flagship } from '@/data/brands';

/** What buyers said — chosen for what they say about fit and confidence, not just praise. */
export function ReviewsSection({ reviews }: { reviews: Flagship['reviews'] }) {
  return (
    <section aria-labelledby="reviews-title" className="mx-auto w-full max-w-[1180px] px-4 py-16 sm:px-6 md:py-24">
      <p className="eyebrow text-fg-subtle">In their homes</p>
      <h2 id="reviews-title" className="mt-2 font-display text-[clamp(1.8rem,3.8vw,2.7rem)] leading-tight tracking-tight">
        Placed first. Then ordered.
      </h2>
      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {reviews.map((r) => (
          <li key={r.name} className="flex flex-col gap-5 rounded-store border border-line/12 bg-surface-raised p-6">
            <Quote size={22} aria-hidden className="text-accent" />
            <blockquote className="flex-1 font-display text-xl leading-snug">{r.quote}</blockquote>
            <footer className="flex items-end justify-between gap-3 border-t border-line/10 pt-4 text-sm">
              <span>
                <span className="block font-semibold">{r.name}</span>
                <span className="text-fg-subtle">{r.place}</span>
              </span>
              <span className="rounded-full border border-line/15 px-2.5 py-1 text-xs text-fg-muted">{r.piece}</span>
            </footer>
          </li>
        ))}
      </ul>
    </section>
  );
}
