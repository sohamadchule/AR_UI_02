import { Router } from 'express';
import QRCode from 'qrcode';
import { getModelBlob, getModelFile, getVariant, listVariants } from './catalog.mjs';
import { buildViewUrl } from './url.mjs';

export const api = Router();

const notFound = (res, what = 'Not found') => res.status(404).json({ error: what });

/** Wrap async handlers so rejections reach the error middleware. */
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

// GET /api/variants: everything viewable.
api.get('/variants', wrap(async (_req, res) => {
  res.json({ variants: await listVariants() });
}));

// GET /api/variants/:id
api.get('/variants/:id', wrap(async (req, res) => {
  const variant = await getVariant(req.params.id);
  if (!variant) return notFound(res, 'Variant not found');
  res.json({ variant });
}));

/** Stream GLB bytes with an ETag; `immutable` only when the URL itself names the content. */
function sendGlb(req, res, file, immutable) {
  const etag = `"${file.sha256}"`;
  res.set({ ETag: etag, 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate' });
  if (req.get('if-none-match') === etag) return res.status(304).end();
  res.set({
    'Content-Type': 'model/gltf-binary',
    'Content-Length': String(file.size_bytes),
    'Content-Disposition': 'inline',
  });
  res.end(file.content);
}

// GET /api/models/:sha256: a GLB by content hash; what the viewer loads.
// Colour variants of a product share one file, so they share this URL and the cache.
api.get('/models/:sha256', wrap(async (req, res) => {
  const file = await getModelBlob(req.params.sha256);
  if (!file) return notFound(res, 'Model not found');
  sendGlb(req, res, file, true);
}));

// GET /api/variants/:id/model: a variant's current GLB (stable URL; revalidated via ETag).
api.get('/variants/:id/model', wrap(async (req, res) => {
  const file = await getModelFile(req.params.id);
  if (!file) return notFound(res, 'Model not found');
  sendGlb(req, res, file, Boolean(req.query.v));
}));

/** The page a QR opens, carrying `?mix=` (colours picked for the extra parts) when it is well formed. */
const MIX = /^[1-9]-[0-9A-Fa-f]{6}(\.[1-9]-[0-9A-Fa-f]{6}){0,7}$/;
const viewUrlFor = (req, variant) => {
  const mix = typeof req.query.mix === 'string' && MIX.test(req.query.mix) ? req.query.mix.toUpperCase() : null;
  return `${buildViewUrl(req, variant.id)}${mix ? `?mix=${mix}` : ''}`;
};

// GET /api/variants/:id/share?mix=: the exact URL the QR encodes (reachable from a phone).
api.get('/variants/:id/share', wrap(async (req, res) => {
  const variant = await getVariant(req.params.id);
  if (!variant) return notFound(res, 'Variant not found');
  res.json({ url: viewUrlFor(req, variant) });
}));

// GET /api/variants/:id/qr?format=png|svg&download=1&mix=
// Encodes <base>/view/<id>: never the model file, so a replaced model keeps the same QR.
api.get('/variants/:id/qr', wrap(async (req, res) => {
  const variant = await getVariant(req.params.id);
  if (!variant) return notFound(res, 'Variant not found');

  const format = String(req.query.format ?? 'png').toLowerCase();
  if (format !== 'png' && format !== 'svg') return res.status(400).json({ error: 'format must be png or svg' });

  const target = viewUrlFor(req, variant);
  const options = { margin: 2, width: 512, errorCorrectionLevel: 'M' };
  const body = format === 'svg'
    ? await QRCode.toString(target, { ...options, type: 'svg' })
    : await QRCode.toBuffer(target, { ...options, type: 'png' });

  res.set({
    'Content-Type': format === 'svg' ? 'image/svg+xml; charset=utf-8' : 'image/png',
    'Cache-Control': 'no-store',
    'X-QR-Target': target,
  });
  if (req.query.download === '1') {
    res.set('Content-Disposition', `attachment; filename="qr-${variant.sku.toLowerCase()}.${format}"`);
  }
  res.send(body);
}));
