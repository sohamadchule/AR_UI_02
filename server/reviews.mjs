import express, { Router } from 'express';
import { requireAdmin } from './auth.mjs';
import { pool } from './db.mjs';

/**
 * Customer reviews on client storefronts.
 *   POST /api/reviews                 visitor submits one; it waits as 'pending'
 *   GET  /api/reviews?brand=<slug>    approved reviews, newest first (public)
 *   GET  /api/reviews/admin           every review, for moderation (admin)
 *   PATCH /api/reviews/:id { status } approve / reject (admin)
 *   DELETE /api/reviews/:id           remove for good, e.g. a sample (admin)
 */
export const reviews = Router();
reviews.use(express.json({ limit: '8kb' }));

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null);
const SLUG = /^[a-z0-9-]{1,60}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['pending', 'approved', 'rejected'];
const PUBLIC_COLUMNS = 'id, name, place, piece, quote, created_at';

/** Returns { value } or { errors: { field: message } }. */
export function validateReview(body = {}) {
  const value = {
    brand: text(body.brand),
    name: text(body.name),
    place: text(body.place),
    piece: text(body.piece),
    quote: text(body.quote),
  };
  const errors = {};
  if (!value.brand || !SLUG.test(value.brand)) errors.brand = 'Unknown store.';
  if (!value.name) errors.name = 'Please enter your name.';
  else if (value.name.length > 80) errors.name = 'Name is too long.';
  if (value.place && value.place.length > 80) errors.place = 'Too long.';
  if (value.piece && value.piece.length > 80) errors.piece = 'Too long.';
  if (!value.quote || value.quote.length < 10) errors.quote = 'Please write at least a sentence (10 characters or more).';
  else if (value.quote.length > 600) errors.quote = 'Please keep it under 600 characters.';
  return Object.keys(errors).length ? { errors } : { value };
}

// Naive in-memory limiter: 3 reviews per IP per hour.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60_000);
  if (recent.length >= 3) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

reviews.post('/', wrap(async (req, res) => {
  // Honeypot: bots fill the hidden field. Pretend success, store nothing.
  if (text(req.body?.website)) return res.status(201).json({ ok: true });
  if (limited(req.ip)) return res.status(429).json({ error: 'Too many reviews from here. Please try again later.' });
  const { value, errors } = validateReview(req.body);
  if (errors) return res.status(400).json({ error: 'Invalid review', errors });
  await pool.query(
    'INSERT INTO store_review (brand_slug, name, place, piece, quote) VALUES ($1, $2, $3, $4, $5)',
    [value.brand, value.name, value.place, value.piece, value.quote],
  );
  res.status(201).json({ ok: true });
}));

reviews.get('/', wrap(async (req, res) => {
  const brand = text(req.query.brand);
  if (!brand || !SLUG.test(brand)) return res.status(400).json({ error: 'brand is required' });
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM store_review WHERE brand_slug = $1 AND status = 'approved' ORDER BY created_at DESC LIMIT 24`,
    [brand],
  );
  res.json({ reviews: rows });
}));

reviews.get('/admin', requireAdmin, wrap(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM store_review ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 500`,
  );
  res.json({ reviews: rows });
}));

reviews.patch('/:id', requireAdmin, wrap(async (req, res) => {
  const { status } = req.body ?? {};
  if (!UUID.test(req.params.id) || !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid request' });
  const { rows } = await pool.query('UPDATE store_review SET status = $2 WHERE id = $1 RETURNING *', [req.params.id, status]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ review: rows[0] });
}));

reviews.delete('/:id', requireAdmin, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid request' });
  const { rowCount } = await pool.query('DELETE FROM store_review WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}));
