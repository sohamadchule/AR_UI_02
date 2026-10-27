import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Check, LogOut, MessageCircle, Phone, RefreshCw, Trash2 } from 'lucide-react';
import {
  deleteDesign,
  fetchAdminDesigns,
  updateDesignStatus,
  viewPath,
  type AdminDesignRow,
  type DesignStats,
  type DesignStatus,
} from '@/lib/api';
import { BRANDS, brandBySlug } from '@/data/brands';
import { Button, buttonClasses } from '@/components/ui/Button';
import { AdminSignIn, useAdminToken } from '@/features/admin/AdminSignIn';
import { cn } from '@/lib/cn';

const FILTERS = ['new', 'contacted', 'closed', 'all'] as const;

const BADGE: Record<DesignStatus, string> = {
  new: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  contacted: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  closed: 'bg-fg/10 text-fg-muted',
};

/** wa.me wants the number in international form without symbols; Indian numbers often come without +91. */
const waNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line/12 p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-fg-subtle">{label}</p>
      <p className="mt-2 text-3xl font-light tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-fg-muted">{hint}</p>}
    </div>
  );
}

/**
 * Admin: designs shoppers sent from a store's Craft page. Each is a lead (name, phone, the
 * piece and its colour per part); the numbers on top show how many the website brings in.
 */
export function AdminDesignRequestsPage() {
  const { token, signIn, signOut } = useAdminToken();
  const [rows, setRows] = useState<AdminDesignRow[] | null>(null);
  const [stats, setStats] = useState<DesignStats | null>(null);
  const [stores, setStores] = useState<{ brand: string; count: number }[]>([]);
  const [brand, setBrand] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('new');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
      const data = await fetchAdminDesigns(token, brand);
      setRows(data.requests);
      setStats(data.stats);
      setStores(data.stores);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }, [token, brand, fail]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.title = 'Design requests · Admin';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  async function setStatus(row: AdminDesignRow, status: DesignStatus) {
    setBusy(row.id);
    try {
      const updated = await updateDesignStatus(token, row.id, status);
      setRows((r) => r?.map((x) => (x.id === row.id ? updated : x)) ?? null);
      setStats((s) => s && { ...s, waiting: s.waiting + (status === 'new' ? 1 : 0) - (row.status === 'new' ? 1 : 0) });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: AdminDesignRow) {
    if (!window.confirm(`Delete ${row.name}'s design request? This cannot be undone.`)) return;
    setBusy(row.id);
    try {
      await deleteDesign(token, row.id);
      void load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  if (!token) return <AdminSignIn onSignIn={signIn} purpose="see design requests" error={error} />;

  const count = (f: (typeof FILTERS)[number]) => (rows ?? []).filter((r) => f === 'all' || r.status === f).length;
  const shown = (rows ?? []).filter((r) => filter === 'all' || r.status === filter);
  const storeName = (slug: string) => brandBySlug(slug)?.legalName ?? slug;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 pb-24 pt-28 md:pt-32">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-fg-subtle">
            <Link to="/admin" className="hover:text-fg">
              Admin
            </Link>{' '}
            · Design requests
          </p>
          <h1 className="mt-2 text-3xl font-light tracking-tight">Design requests</h1>
          <p className="mt-1 text-sm text-fg-muted">Shoppers who designed a piece on a store&apos;s Craft page and asked to be called.</p>
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

      <label className="mb-6 flex items-center gap-3 text-sm text-fg-muted">
        Store
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="rounded-xl border border-line/15 bg-surface px-3 py-2 text-sm text-fg focus:border-fg focus:outline-none"
        >
          <option value="">All stores</option>
          {BRANDS.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.legalName} ({stores.find((s) => s.brand === b.slug)?.count ?? 0})
            </option>
          ))}
        </select>
      </label>

      {stats && (
        <section aria-label="How the website is helping" className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Leads from the website" value={stats.total} hint="Designs sent from the Craft page" />
          <Stat label="Last 7 days" value={stats.last7} />
          <Stat label="Last 30 days" value={stats.last30} />
          <Stat label="Waiting for a call" value={stats.waiting} hint={stats.waiting ? 'Marked new' : 'All followed up'} />
          {stats.topProducts.length > 0 && (
            <div className="rounded-2xl border border-line/12 p-5 sm:col-span-2 lg:col-span-4">
              <p className="text-xs uppercase tracking-[0.14em] text-fg-subtle">Most designed pieces</p>
              <ul className="mt-3 space-y-2">
                {stats.topProducts.map((p) => (
                  <li key={p.product} className="flex items-center gap-3 text-sm">
                    <span className="w-48 truncate">{p.product}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-fg/10" aria-hidden>
                      <span className="block h-full rounded-full bg-fg/60" style={{ width: `${(p.count / stats.topProducts[0].count) * 100}%` }} />
                    </span>
                    <span className="w-8 text-right tabular-nums text-fg-muted">{p.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

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

      {rows && shown.length === 0 && (
        <p className="py-16 text-center text-sm text-fg-muted">
          {rows.length === 0 ? 'No designs yet. They arrive here when shoppers send one from a store’s Craft page.' : `No ${filter} requests.`}
        </p>
      )}

      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.id} className="rounded-2xl border border-line/12 p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={cn('rounded-full px-2.5 py-0.5 font-medium capitalize', BADGE[r.status])}>{r.status}</span>
              <span className="rounded-full border border-line/15 px-2.5 py-0.5 text-fg-muted">{storeName(r.brand_slug)}</span>
              <span className="ml-auto text-fg-subtle">{new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="font-medium">{r.product_name}</p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {r.design.map((d) => (
                    <li key={d.part} className="flex items-center gap-2.5">
                      <i className="block h-4 w-4 shrink-0 rounded-full border border-fg/15" style={{ backgroundColor: d.hex ?? 'transparent' }} aria-hidden />
                      <span className="text-fg-muted">{d.part}</span>
                      <span className="font-medium">{d.colour ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-sm">
                <p className="font-medium">{r.name}</p>
                <p className="mt-1 text-fg-muted">
                  {r.phone}
                  {r.city && ` · ${r.city}`}
                </p>
                {r.note && <p className="mt-2 rounded-xl bg-fg/[0.04] px-3 py-2 leading-relaxed">“{r.note}”</p>}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} className={buttonClasses('primary', 'sm')}>
                <Phone size={14} aria-hidden /> Call
              </a>
              <a
                href={`https://wa.me/${waNumber(r.phone)}?text=${encodeURIComponent(`Hi ${r.name}, thank you for your ${r.product_name} design on ${storeName(r.brand_slug)}.`)}`}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses('outline', 'sm')}
              >
                <MessageCircle size={14} aria-hidden /> WhatsApp
              </a>
              {r.variant_id && (
                <a href={`${viewPath(r.variant_id)}${r.mix ? `?mix=${r.mix}` : ''}`} target="_blank" rel="noreferrer" className={buttonClasses('outline', 'sm')}>
                  <Box size={14} aria-hidden /> Open design in 3D
                </a>
              )}
              {r.status === 'new' && (
                <Button variant="outline" size="sm" disabled={busy === r.id} onClick={() => void setStatus(r, 'contacted')} icon={<Check size={14} />}>
                  Mark contacted
                </Button>
              )}
              {r.status !== 'closed' && (
                <Button variant="outline" size="sm" disabled={busy === r.id} onClick={() => void setStatus(r, 'closed')}>
                  Close
                </Button>
              )}
              {r.status !== 'new' && (
                <Button variant="outline" size="sm" disabled={busy === r.id} onClick={() => void setStatus(r, 'new')}>
                  Reopen
                </Button>
              )}
              <Button variant="outline" size="sm" disabled={busy === r.id} onClick={() => void remove(r)} icon={<Trash2 size={14} />} className="text-red-600 dark:text-red-400">
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
