import type { Tint } from '@/lib/color';
import type { Unit } from '@/lib/units';

export interface Dimensions {
  width: number | null;
  height: number | null;
  depth: number | null;
}

export interface Variant {
  id: string;
  sku: string;
  name: string;
  /** Fabric / material label, e.g. "Velvet". */
  material: string | null;
  /** The colour the recolourable part is shown in; null when the model is shown as authored. */
  colorHex: string | null;
  isDefault: boolean;
  product: {
    id: string;
    slug: string;
    name: string;
    description: string;
    /** One line for a catalogue tile; '' when not set. */
    blurb: string;
    /** Selling price in whole rupees; null when the catalogue has no price yet. */
    priceInr: number | null;
    /** Struck-through list price in whole rupees, or null. */
    mrpInr: number | null;
    /** Size entered by the uploader, in mm; null when not given. */
    dimensionsMm: Dimensions | null;
    /** Unit the product's size is displayed in. */
    dimensionUnit: Unit;
  };
  category: { slug: string; name: string };
  model: {
    /** Content-addressed GLB URL; colour variants of one product share it. */
    url: string;
    sizeBytes: number;
    version: number;
    /** Real-world size in metres, read from the GLB. */
    dimensionsM: { width: number; height: number; depth: number } | null;
    /** Materials to recolour to `colorHex`; null when the model is shown as authored. */
    tint: Tint | null;
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

/** An admin call failed; `fieldErrors` maps form fields to messages when the server sent them. */
export class AdminApiError extends Error {
  constructor(message: string, public fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}

async function adminFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (res.status === 401) throw new Error('Invalid admin token');
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: Record<string, string> };
    throw new AdminApiError(body.error ?? `Request failed (${res.status})`, body.errors);
  }
  return res.json() as Promise<T>;
}

export const fetchDemoRequests = (token: string) =>
  adminFetch<{ requests: DemoRequestRow[] }>(token, '/api/demo-requests').then((r) => r.requests);

export const updateDemoStatus = (token: string, id: string, status: DemoStatus) =>
  adminFetch<{ request: DemoRequestRow }>(token, `/api/demo-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }).then((r) => r.request);

export interface Category {
  id: string;
  slug: string;
  name: string;
}

/** A rendered material of an uploaded model, as analysed by the server. */
export interface ModelMaterial {
  index: number;
  name: string;
  /** Average colour the material shows as authored. */
  hex: string;
  texAvg: [number, number, number];
  /** Average linear colour as authored. */
  base: [number, number, number];
  /** KHR_materials_sheen colour, or null. */
  sheen: [number, number, number] | null;
  /** Emissive (a light): its glow hides the base colour, so a recolour barely shows. */
  glows: boolean;
  /** Fraction of the model's surface drawn with this material (0–1); null if it couldn't be measured. */
  share: number | null;
  /** The parts (glTF nodes) drawn with it, biggest first; `share` is their fraction of the surface. */
  parts: { node: number; name: string; share: number | null }[];
  /** The biggest surface: on furniture, normally the main body. */
  largest: boolean;
  textured: boolean;
  /** The texture carries its own colour cast, so only nearby colours are reachable. */
  patterned: boolean;
  /** Looks like upholstery by name; pre-selected as recolourable. */
  suggested: boolean;
}

export interface UploadedModel {
  sha256: string;
  filename: string;
  sizeBytes: number;
  materials: ModelMaterial[];
  /** Size read from the model, in mm. */
  dimensionsMm: { width: number; height: number; depth: number } | null;
}

export interface NewProductInput {
  name: string;
  description?: string;
  status: 'draft' | 'active';
  categoryId?: string;
  newCategory?: string;
  model: { sha256: string; filename: string; tintMaterials: number[] };
  /** Values in `unit`; empty fields are omitted. */
  dimensions: { unit: Unit; width?: number; height?: number; depth?: number };
  colours: { name: string; hex?: string; fabric?: string; sku?: string; isDefault: boolean }[];
}

export interface CreatedProduct {
  product: { id: string; slug: string; status: 'draft' | 'active' };
  variants: { id: string; sku: string; name: string; isDefault: boolean }[];
}

export const fetchCategories = (token: string) =>
  adminFetch<{ categories: Category[] }>(token, '/api/admin/categories').then((r) => r.categories);

export const uploadModel = (token: string, file: File) =>
  adminFetch<UploadedModel>(token, '/api/admin/models', {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': 'model/gltf-binary', 'X-Filename': encodeURIComponent(file.name) },
  });

/** Give some parts their own copy of a material; returns the new (stored) model. */
export const splitModel = (
  token: string,
  sha256: string,
  filename: string,
  groups: { material: number; nodes: number[]; name: string }[],
) =>
  adminFetch<UploadedModel & { created: { index: number; name: string; from: number }[] }>(token, `/api/admin/models/${sha256}/split`, {
    method: 'POST',
    body: JSON.stringify({ groups, filename }),
  });

/** An uploaded model's bytes (admin only, it may be unpublished), for the preview. */
export async function fetchAdminModel(token: string, sha256: string): Promise<Blob> {
  const res = await fetch(`/api/admin/models/${sha256}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('Invalid admin token');
  if (!res.ok) throw new Error(`Could not load the model (${res.status})`);
  return res.blob();
}

export const createProduct = (token: string, input: NewProductInput) =>
  adminFetch<CreatedProduct>(token, '/api/admin/products', { method: 'POST', body: JSON.stringify(input) });
