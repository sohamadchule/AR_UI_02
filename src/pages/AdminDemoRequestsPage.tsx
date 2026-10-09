import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, RefreshCw } from 'lucide-react';
import { fetchDemoRequests, updateDemoStatus, type DemoRequestRow, type DemoStatus } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

const TOKEN_KEY = 'akruti.adminToken';
const STATUSES: DemoStatus[] = ['new', 'contacted', 'closed'];
const FILTERS = ['all', ...STATUSES] as const;

const BADGE: Record<DemoStatus, string> = {
  new: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  contacted: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  closed: 'bg-fg/10 text-fg-muted',
};

const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
};

export function AdminDemoRequestsPage() {
  const [token, setToken] = useState(readToken);
  const [draft, setDraft] = useState('');
  const [rows, setRows] = useState<DemoRequestRow[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [open, setOpen] = useState<string | null>(null);

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setToken('');
    setRows(null);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setRows(await fetchDemoRequests(token));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      if (msg === 'Invalid admin token') signOut();
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.title = 'Demo requests · Admin';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  function signIn(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* ignore */
    }
    setDraft('');
    setToken(t);
  }

  async function changeStatus(row: DemoRequestRow, status: DemoStatus) {
    const before = rows;
    setRows((r) => r && r.map((x) => (x.id === row.id ? { ...x, status } : x)));
    try {
      await updateDemoStatus(token, row.id, status);
    } catch (e) {
      setRows(before);
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-6">
        <form onSubmit={signIn} className="w-full max-w-sm space-y-4 rounded-3xl border border-line/10 bg-surface-raised p-8">
          <h1 className="text-xl font-light text-fg">Admin access</h1>
          <p className="text-sm text-fg-muted">Enter the admin token to view demo requests.</p>
          <input
            type="password"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Admin token"
            className="w-full rounded-xl border border-line/15 bg-surface px-4 py-3 text-sm text-fg focus:border-fg focus:outline-none"
          />
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </main>
    );
  }

  const shown = rows?.filter((r) => filter === 'all' || r.status === filter) ?? [];
  const count = (s: DemoStatus) => rows?.filter((r) => r.status === s).length ?? 0;

  return (
    <main className="min-h-screen bg-surface px-6 py-10 text-fg md:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/" className="text-xs uppercase tracking-[0.2em] text-fg-subtle hover:text-fg">
              ← Akruti
            </Link>
            <h1 className="mt-2 text-3xl font-light">Demo requests</h1>
            <p className="mt-1 text-sm text-fg-muted">
              {rows ? `${rows.length} total · ${count('new')} new` : 'Loading…'}
            </p>
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

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.12em] transition-colors',
                filter === f ? 'border-fg bg-fg text-surface' : 'border-line/15 text-fg-muted hover:border-fg',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mb-4 text-sm text-red-500">{error}</p>}

        <div className="overflow-x-auto rounded-2xl border border-line/10 bg-surface-raised">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line/10 text-xs uppercase tracking-[0.12em] text-fg-subtle">
              <tr>
                {['Received', 'Name', 'Company', 'Interest', 'Status', 'Email', 'Confirmation'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <FragmentRow
                  key={r.id}
                  r={r}
                  expanded={open === r.id}
                  onToggle={() => setOpen(open === r.id ? null : r.id)}
                  onStatus={(s) => void changeStatus(r, s)}
                />
              ))}
              {rows && !shown.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-fg-muted">No requests yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function FragmentRow({
  r,
  expanded,
  onToggle,
  onStatus,
}: {
  r: DemoRequestRow;
  expanded: boolean;
  onToggle: () => void;
  onStatus: (s: DemoStatus) => void;
}) {
  return (
    <>
      <tr className="cursor-pointer border-b border-line/5 hover:bg-fg/5" onClick={onToggle}>
        <td className="whitespace-nowrap px-4 py-3 text-fg-muted">{new Date(r.created_at).toLocaleString()}</td>
        <td className="px-4 py-3">
          <div className="text-fg">{r.name}</div>
          {r.phone && (
            <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} className="block text-xs text-fg-muted hover:text-fg">
              {r.phone}
            </a>
          )}
          <a href={`mailto:${r.email}`} onClick={(e) => e.stopPropagation()} className="text-xs text-fg-muted hover:text-fg">
            {r.email}
          </a>
        </td>
        <td className="px-4 py-3">
          {r.company}
          {r.role && <div className="text-xs text-fg-muted">{r.role}</div>}
        </td>
        <td className="px-4 py-3 text-fg-muted">{r.interest ?? '—'}</td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <select
            value={r.status}
            onChange={(e) => onStatus(e.target.value as DemoStatus)}
            aria-label={`Status for ${r.name}`}
            className={cn('rounded-full border-0 px-3 py-1 text-xs font-medium uppercase tracking-wider focus:outline-none', BADGE[r.status])}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s} className="bg-surface text-fg">{s}</option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 text-xs">
          {r.email_verified_at ? <span className="text-emerald-600 dark:text-emerald-400">Verified</span> : <span className="text-amber-600 dark:text-amber-400">Unverified</span>}
        </td>
        <td className="px-4 py-3 text-xs text-fg-muted">{r.confirmation_sent ? 'Sent' : 'Not sent'}</td>
      </tr>
      {expanded && (
        <tr className="border-b border-line/5 bg-fg/[0.03]">
          <td colSpan={7} className="whitespace-pre-wrap px-4 py-4 text-fg-soft">
            {r.message || <span className="text-fg-subtle">No message.</span>}
          </td>
        </tr>
      )}
    </>
  );
}
