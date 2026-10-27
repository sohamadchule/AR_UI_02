import express, { Router } from 'express';
import { requireAdmin } from './auth.mjs';
import { getVariant } from './catalog.mjs';
import { pool } from './db.mjs';

/**
 * Shoppers' own designs, sent to the shop from a storefront's Craft page.
 *   POST   /api/designs                 shopper sends a design with their contact details
 *   GET    /api/designs/admin?brand=    every request plus lead numbers, optionally for one store (admin)
 *   PATCH  /api/designs/:id { status }  new / contacted / closed (admin)
 *   DELETE /api/designs/:id             remove for good (admin)
 */
export const designs = Router();
designs.use(express.json({ limit: '8kb' }));

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null);
const SLUG = /^[a-z0-9-]{1,60}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIX = /^[1-9]-[0-9A-Fa-f]{6}(\.[1-9]-[0-9A-Fa-f]{6}){0,7}$/;
const STATUSES = ['new', 'contacted', 'closed'];

/** Returns { value } or { errors: { field: message } }. */
export function validateDesign(body = {}) {
  const value = {
    brand: text(body.brand),
    variantId: text(body.variantId),
    mix: text(body.mix),
    name: text(body.name),
    phone: text(body.phone),
    city: text(body.city),
    note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
  };
  const errors = {};
  if (!value.brand || !SLUG.test(value.brand)) errors.brand = 'Unknown store.';
  if (!value.variantId || !UUID.test(value.variantId)) errors.variantId = 'Choose a piece to design.';
  if (value.mix && !MIX.test(value.mix)) value.mix = null;
  if (!value.name) errors.name = 'Please enter your name.';
  else if (value.name.length > 80) errors.name = 'Name is too long.';
  if (!value.phone) errors.phone = 'Please enter your phone number, so the shop can call you.';
  else if (!/^\+?[\d\s().-]{7,20}$/.test(value.phone) || value.phone.replace(/\D/g, '').length < 7) errors.phone = 'Please enter a valid phone number.';
  if (value.city && value.city.length > 80) errors.city = 'Too long.';
  if (value.note && value.note.length > 600) errors.note = 'Please keep it under 600 characters.';
  return Object.keys(errors).length ? { errors } : { value };
}

/**
 * The design part by part, read from the catalogue rather than the client: the main part in
 * the variant's colour, each extra part in the colour from `mix` (or its own).
 */
function describeDesign(variant, mix) {
  const parts = variant.model.tint?.parts;
  const main = { part: parts?.[0]?.name ?? 'Colour', colour: variant.name, hex: variant.colorHex };
  if (!parts || parts.length < 2) return [main];
  const picked = new Map((mix ?? '').split('.').filter(Boolean).map((e) => [Number(e.split('-')[0]), `#${e.split('-')[1]}`.toUpperCase()]));
  return [
    main,
    ...parts.slice(1).map((part, i) => {
      const colour = part.colours.find((c) => c.hex === picked.get(i + 1)) ?? part.colours[0];
      return { part: part.name, colour: colour?.name ?? null, hex: colour?.hex ?? null };
    }),
  ];
}

// Naive in-memory limiter: 5 designs per IP per hour.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60_000);
  if (recent.length >= 5) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

designs.post('/', wrap(async (req, res) => {
  // Honeypot: bots fill the hidden field. Pretend success, store nothing.
  if (text(req.body?.website)) return res.status(201).json({ ok: true });
  const { value, errors } = validateDesign(req.body);
  if (errors) return res.status(400).json({ error: 'Please check the highlighted fields.', errors });
  const variant = await getVariant(value.variantId);
  if (!variant) return res.status(400).json({ error: 'That piece is no longer in the catalogue.', errors: { variantId: 'Choose another piece.' } });
  if (limited(req.ip)) return res.status(429).json({ error: 'Too many designs sent from here. Please try again later.' });
  const design = describeDesign(variant, value.mix);
  const { rows: [row] } = await pool.query(
    `INSERT INTO design_request (brand_slug, variant_id, product_name, design, mix, name, phone, city, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [value.brand, variant.id, variant.product.name, JSON.stringify(design), value.mix, value.name, value.phone, value.city, value.note],
  );
  res.status(201).json({ ok: true, id: row.id, design });
}));

designs.get('/admin', requireAdmin, wrap(async (req, res) => {
  const brand = text(req.query.brand);
  const where = brand && SLUG.test(brand) ? 'WHERE brand_slug = $1' : '';
  const params = where ? [brand] : [];
  const [{ rows }, { rows: [stats] }, { rows: top }, { rows: stores }] = await Promise.all([
    pool.query(`SELECT * FROM design_request ${where} ORDER BY created_at DESC LIMIT 500`, params),
    pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS "last7",
              count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS "last30",
              count(*) FILTER (WHERE status = 'new')::int AS "waiting"
         FROM design_request ${where}`,
      params,
    ),
    pool.query(
      `SELECT product_name AS product, count(*)::int AS count FROM design_request ${where}
        GROUP BY product_name ORDER BY count DESC, product_name LIMIT 5`,
      params,
    ),
    pool.query('SELECT brand_slug AS brand, count(*)::int AS count FROM design_request GROUP BY brand_slug ORDER BY count DESC'),
  ]);
  res.json({ requests: rows, stats: { ...stats, topProducts: top }, stores });
}));

designs.patch('/:id', requireAdmin, wrap(async (req, res) => {
  const { status } = req.body ?? {};
  if (!UUID.test(req.params.id) || !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid request' });
  const { rows } = await pool.query('UPDATE design_request SET status = $2 WHERE id = $1 RETURNING *', [req.params.id, status]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ request: rows[0] });
}));

designs.delete('/:id', requireAdmin, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid request' });
  const { rowCount } = await pool.query('DELETE FROM design_request WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
}));
