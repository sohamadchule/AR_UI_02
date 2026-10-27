import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, ExternalLink, LogOut, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { deleteProduct, deleteVariant, fetchAdminProducts, viewPath, type AdminProductRow } from '@/lib/api';
import { Button, buttonClasses } from '@/components/ui/Button';
import { AdminSignIn, useAdminToken } from '@/features/admin/AdminSignIn';
import { cn } from '@/lib/cn';

const BADGE: Record<AdminProductRow['status'], string> = {
  active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  draft: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  archived: 'bg-fg/10 text-fg-muted',
};

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** The still rendered from the model, when one exists; otherwise a plain box icon. */
function Thumb({ variantId, alt }: { variantId: string | undefined; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-raised">
      {variantId && !failed ? (
        <img src={`/posters/${variantId}.webp`} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-contain" />
      ) : (
        <Box size={26} aria-hidden className="text-fg-subtle" />
      )}
    </div>
  );
}

/** Admin: every product in the catalogue, with the power to delete a product or one of its colours. */
export function AdminModelsPage() {
  const { token, signIn, signOut } = useAdminToken();
  const [rows, setRows] = useState<AdminProductRow[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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
      setRows(await fetchAdminProducts(token));
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
    document.title = 'Models · Admin';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  async function removeProduct(p: AdminProductRow) {
    const colours = p.variants.length === 1 ? '1 colour' : `${p.variants.length} colours`;
    if (
      !window.confirm(
        `Delete “${p.name}” and its ${colours}?\n\nIts 3D model, product page and every QR code printed for it will stop working. This cannot be undone.`,
      )
    )
      return;
    setBusy(p.id);
    setNotice('');
    try {
      await deleteProduct(token, p.id);
      setRows((r) => r?.filter((x) => x.id !== p.id) ?? null);
      setNotice(`Deleted “${p.name}”.`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function removeColour(p: AdminProductRow, v: AdminProductRow['variants'][number]) {
    if (!window.confirm(`Delete the “${v.name}” colour of ${p.name}?\n\nQR codes printed for this colour will stop working. This cannot be undone.`)) return;
    setBusy(v.id);
    setNotice('');
    try {
      await deleteVariant(token, v.id);
      // The server may have promoted another colour to default; reload to show it.
      await load();
      setNotice(`Deleted the “${v.name}” colour of ${p.name}.`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  if (!token) return <AdminSignIn onSignIn={signIn} purpose="manage models" error={error} />;

  const needle = query.trim().toLowerCase();
  const shown = (rows ?? []).filter(
    (p) => !needle || [p.name, p.category, p.slug, ...p.variants.map((v) => v.sku)].some((s) => s.toLowerCase().includes(needle)),
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 pb-24 pt-28 md:pt-32">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-fg-subtle">
            <Link to="/admin" className="hover:text-fg">
              Admin
            </Link>{' '}
            · Models
          </p>
          <h1 className="mt-2 text-3xl font-light tracking-tight">Models</h1>
          <p className="mt-1 text-sm text-fg-muted">{rows ? `${rows.length} products in the catalogue, drafts included.` : 'Loading…'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/models/new" className={buttonClasses('primary', 'md')}>
            <Upload size={14} aria-hidden /> Upload model
          </Link>
          <Button variant="outline" size="md" onClick={() => void load()} disabled={loading} icon={<RefreshCw size={14} className={cn(loading && 'animate-spin')} />}>
            Refresh
          </Button>
          <Button variant="outline" size="md" onClick={signOut} icon={<LogOut size={14} />}>
            Sign out
          </Button>
        </div>
      </header>

      <label className="relative mb-6 block">
        <span className="sr-only">Search products</span>
        <Search size={16} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, category or SKU"
          className="w-full rounded-xl border border-line/15 bg-surface py-3 pl-11 pr-4 text-sm text-fg focus:border-fg focus:outline-none"
        />
      </label>

      {error && (
        <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
        </p>
      )}

      {rows && shown.length === 0 && (
        <p className="py-16 text-center text-sm text-fg-muted">{needle ? 'No products match that search.' : 'No products yet.'}</p>
      )}

      <ul className="space-y-3">
        {shown.map((p) => {
          const main = p.variants.find((v) => v.isDefault) ?? p.variants[0];
          return (
            <li key={p.id} className={cn('rounded-2xl border border-line/12 p-5 transition-opacity', busy === p.id && 'opacity-50')}>
              <div className="flex flex-wrap items-start gap-4">
                <Thumb variantId={main?.id} alt={p.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn('rounded-full px-2.5 py-0.5 font-medium capitalize', BADGE[p.status])}>{p.status}</span>
                    <span className="rounded-full border border-line/15 px-2.5 py-0.5 text-fg-muted">{p.category}</span>
                    {p.modelBytes > 0 && <span className="text-fg-subtle">{formatSize(p.modelBytes)}</span>}
                    <span className="ml-auto text-fg-subtle">
                      Added {new Date(p.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg">{p.name}</h2>

                  <ul aria-label={`Colours of ${p.name}`} className="mt-3 flex flex-wrap gap-2">
                    {p.variants.map((v) => (
                      <li
                        key={v.id}
                        className={cn(
                          'flex items-center gap-2 rounded-full border border-line/15 py-1 pl-1.5 text-sm',
                          p.variants.length > 1 ? 'pr-1' : 'pr-3',
                          busy === v.id && 'opacity-50',
                        )}
                      >
                        <i className="block h-4 w-4 rounded-full border border-fg/15" style={{ backgroundColor: v.colorHex ?? 'transparent' }} />
                        {v.name}
                        {v.isDefault && <span className="text-xs text-fg-subtle">default</span>}
                        {p.variants.length > 1 && (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void removeColour(p, v)}
                            aria-label={`Delete the ${v.name} colour`}
                            title="Delete this colour"
                            className="grid h-6 w-6 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40"
                          >
                            <X size={13} aria-hidden />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line/10 pt-4">
                {main && (
                  <a href={viewPath(main.id)} target="_blank" rel="noreferrer" className={buttonClasses('outline', 'sm')}>
                    <ExternalLink size={14} aria-hidden /> View in 3D
                  </a>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void removeProduct(p)}
                  icon={<Trash2 size={14} />}
                  className="text-red-600 dark:text-red-400"
                >
                  Delete product
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
