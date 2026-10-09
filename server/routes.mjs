import { Router } from 'express';
import QRCode from 'qrcode';
import { getModelFile, getVariant, listVariants } from './catalog.mjs';
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

// GET /api/variants/:id/model: the current GLB, streamed from the database.
// The URL carries ?v=<hash prefix>, so the response is safe to cache forever.
api.get('/variants/:id/model', wrap(async (req, res) => {
  const file = await getModelFile(req.params.id);
  if (!file) return notFound(res, 'Model not found');
  const etag = `"${file.sha256}"`;
  res.set({ ETag: etag, 'Cache-Control': 'public, max-age=31536000, immutable' });
  if (req.get('if-none-match') === etag) return res.status(304).end();
  res.set({
    'Content-Type': file.content_type,
    'Content-Length': String(file.size_bytes),
    'Content-Disposition': 'inline',
  });
  res.end(file.content);
}));

// GET /api/variants/:id/share: the exact URL the QR encodes (reachable from a phone).
api.get('/variants/:id/share', wrap(async (req, res) => {
  const variant = await getVariant(req.params.id);
  if (!variant) return notFound(res, 'Variant not found');
  res.json({ url: buildViewUrl(req, variant.id) });
}));

// GET /api/variants/:id/qr?format=png|svg&download=1
// Encodes <base>/view/<id>: never the model file, so a replaced model keeps the same QR.
api.get('/variants/:id/qr', wrap(async (req, res) => {
  const variant = await getVariant(req.params.id);
  if (!variant) return notFound(res, 'Variant not found');

  const format = String(req.query.format ?? 'png').toLowerCase();
  if (format !== 'png' && format !== 'svg') return res.status(400).json({ error: 'format must be png or svg' });

  const target = buildViewUrl(req, variant.id);
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
