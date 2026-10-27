import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, LogOut, RefreshCw, Trash2, X } from 'lucide-react';
import { deleteReview, fetchAdminReviews, updateReviewStatus, type AdminReviewRow, type ReviewStatus } from '@/lib/api';
import { brandBySlug } from '@/data/brands';
import { Button } from '@/components/ui/Button';
import { AdminSignIn, useAdminToken } from '@/features/admin/AdminSignIn';
import { cn } from '@/lib/cn';

const FILTERS = ['pending', 'approved', 'rejected', 'all'] as const;

const BADGE: Record<ReviewStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  approved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-fg/10 text-fg-muted',
};

/** Admin: approve, reject or delete the reviews visitors leave on client storefronts. */
export function AdminReviewsPage() {
  const { token, signIn, signOut } = useAdminToken();
  const [rows, setRows] = useState<AdminReviewRow[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('pending');
  const [busy, setBusy] = useState<string | null>(null);

  const fail = useCallback(
    (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Request failed';
      if (msg === 'Invalid admin token') signOut();
      setError(msg);
    },
    [signOut],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setRows(await fetchAdminReviews(token));
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }, [token, fail]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.title = 'Reviews · Admin';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  async function setStatus(row: AdminReviewRow, status: ReviewStatus) {
    setBusy(row.id);
    try {
      const updated = await updateReviewStatus(token, row.id, status);
      setRows((r) => r?.map((x) => (x.id === row.id ? updated : x)) ?? null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: AdminReviewRow) {
    if (!window.confirm(`Delete the review by ${row.name}? This cannot be undone.`)) return;
    setBusy(row.id);
    try {
      await deleteReview(token, row.id);
      setRows((r) => r?.filter((x) => x.id !== row.id) ?? null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  if (!token) return <AdminSignIn onSignIn={signIn} purpose="moderate reviews" error={error} />;

  const count = (f: (typeof FILTERS)[number]) => (rows ?? []).filter((r) => f === 'all' || r.status === f).length;
  const shown = (rows ?? []).filter((r) => filter === 'all' || r.status === filter);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 pb-24 pt-28 md:pt-32">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-fg-subtle">
            <Link to="/admin" className="hover:text-fg">
              Admin
            </Link>{' '}
            · Reviews
          </p>
          <h1 className="mt-2 text-3xl font-light tracking-tight">Store reviews</h1>
          <p className="mt-1 text-sm text-fg-muted">Visitors’ reviews appear on the store page only after you approve them.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="md" onClick={() => void load()} disabled={loading} icon={<RefreshCw size={14} className={cn(loading && 'animate-spin')} />}>
            Refresh
          </Button>
          <Button variant="outline" size="md" onClick={signOut} icon={<LogOut size={14} />}>
            Sign out
          </Button>
        </div>
      </header>

      <div role="group" aria-label="Filter by status" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm capitalize transition-colors',
              filter === f ? 'border-fg bg-fg text-surface' : 'border-line/15 text-fg-muted hover:border-fg/40',
            )}
          >
            {f} <span className="opacity-60">{count(f)}</span>
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {rows && shown.length === 0 && <p className="py-16 text-center text-sm text-fg-muted">No {filter === 'all' ? '' : filter} reviews.</p>}

      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.id} className="rounded-2xl border border-line/12 p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={cn('rounded-full px-2.5 py-0.5 font-medium capitalize', BADGE[r.status])}>{r.status}</span>
              <span className="rounded-full border border-line/15 px-2.5 py-0.5 text-fg-muted">{brandBySlug(r.brand_slug)?.legalName ?? r.brand_slug}</span>
              {r.is_sample && <span className="rounded-full border border-dashed border-line/30 px-2.5 py-0.5 text-fg-subtle">Sample text</span>}
              <span className="ml-auto text-fg-subtle">{new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            <blockquote className="mt-3 leading-relaxed">“{r.quote}”</blockquote>
            <p className="mt-2 text-sm text-fg-muted">
              <span className="font-medium text-fg">{r.name}</span>
              {r.place && ` · ${r.place}`}
              {r.piece && ` · about ${r.piece}`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {r.status !== 'approved' && (
                <Button variant="primary" size="sm" disabled={busy === r.id} onClick={() => void setStatus(r, 'approved')} icon={<Check size={14} />}>
                  Approve
                </Button>
              )}
              {r.status !== 'rejected' && (
                <Button variant="outline" size="sm" disabled={busy === r.id} onClick={() => void setStatus(r, 'rejected')} icon={<X size={14} />}>
                  {r.status === 'approved' ? 'Hide' : 'Reject'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={busy === r.id}
                onClick={() => void remove(r)}
                icon={<Trash2 size={14} />}
                className="text-red-600 dark:text-red-400"
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
