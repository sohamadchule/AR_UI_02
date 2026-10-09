export interface Variant {
  id: string;
  sku: string;
  name: string;
  material: string | null;
  isDefault: boolean;
  product: { slug: string; name: string; description: string };
  category: { slug: string; name: string };
  model: {
    /** Stable, cache-busted URL that streams the GLB from the database. */
    url: string;
    sizeBytes: number;
    version: number;
    /** Real-world size in metres, read from the GLB. */
    dimensionsM: { width: number; height: number; depth: number } | null;
  };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(res.status === 404 ? 'Not found' : `Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export const fetchVariants = () => getJson<{ variants: Variant[] }>('/api/variants').then((r) => r.variants);
export const fetchVariant = (id: string) => getJson<{ variant: Variant }>(`/api/variants/${id}`).then((r) => r.variant);

export const qrUrl = (id: string, opts: { format?: 'png' | 'svg'; download?: boolean } = {}) => {
  const params = new URLSearchParams();
  if (opts.format) params.set('format', opts.format);
  if (opts.download) params.set('download', '1');
  const query = params.toString();
  return `/api/variants/${id}/qr${query ? `?${query}` : ''}`;
};

/** The URL a variant's QR encodes, as resolved by the server (LAN / tunnel aware). */
export const fetchShareUrl = (id: string) => getJson<{ url: string }>(`/api/variants/${id}/share`).then((r) => r.url);

/** The stable public page for a variant: the target a QR code encodes. */
export const viewPath = (id: string) => `/view/${id}`;
