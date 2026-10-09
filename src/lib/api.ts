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

export interface DemoRequestInput {
  name: string;
  email: string;
  company: string;
  phone?: string;
  role?: string;
  interest?: string;
  message?: string;
  /** Honeypot: must stay empty. */
  website?: string;
}

export class ApiValidationError extends Error {
  constructor(message: string, public fieldErrors: Partial<Record<keyof DemoRequestInput, string>> = {}) {
    super(message);
  }
}

/** 'sent': a confirmation link was emailed. 'verified': this address was confirmed before. */
export type DemoSubmitResult = 'sent' | 'verified';

export async function submitDemoRequest(input: DemoRequestInput): Promise<DemoSubmitResult> {
  const res = await fetch('/api/demo-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  if (res.ok) return ((await res.json().catch(() => ({}))) as { verification?: DemoSubmitResult }).verification ?? 'sent';
  const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: ApiValidationError['fieldErrors'] };
  throw new ApiValidationError(body.error ?? `Request failed (${res.status})`, body.errors);
}

export async function verifyDemoEmail(token: string): Promise<void> {
  const res = await fetch('/api/demo-requests/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (res.ok) return;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(body.error ?? `Request failed (${res.status})`);
}

export type DemoStatus = 'new' | 'contacted' | 'closed';

export interface DemoRequestRow {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string | null;
  role: string | null;
  interest: string | null;
  message: string | null;
  status: DemoStatus;
  confirmation_sent: boolean;
  email_verified_at: string | null;
  created_at: string;
}

async function adminFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error('Invalid admin token');
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export const fetchDemoRequests = (token: string) =>
  adminFetch<{ requests: DemoRequestRow[] }>(token, '/api/demo-requests').then((r) => r.requests);

export const updateDemoStatus = (token: string, id: string, status: DemoStatus) =>
  adminFetch<{ request: DemoRequestRow }>(token, `/api/demo-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }).then((r) => r.request);
