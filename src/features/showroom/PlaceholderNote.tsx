import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A dashed "placeholder" label, shown only in development, next to content that is
 * still stand-in (stock photos, sample copy, demo phone numbers). It never ships to
 * production, so the shop's live site carries no dev notes — but nobody forgets to
 * replace them before it goes live. Toggle each kind in `Showroom.placeholders`.
 */
export function PlaceholderNote({ show, tone = 'default', children }: { show: boolean; tone?: 'default' | 'light'; children: ReactNode }) {
  if (!import.meta.env.DEV || !show) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-dashed px-2.5 py-1 text-[10px] font-medium normal-case tracking-normal',
        tone === 'light' ? 'border-ivory/40 text-ivory/75' : 'border-fg/25 text-fg-subtle',
      )}
    >
      Placeholder · {children}
    </span>
  );
}
