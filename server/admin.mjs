import { createHash } from 'node:crypto';
import express, { Router } from 'express';
import { glbMeta } from '../db/scripts/glb.mjs';
import { splitParts } from '../db/scripts/split.mjs';
import { analyzeMaterials, buildTint } from '../db/scripts/tint.mjs';
import { requireAdmin } from './auth.mjs';
import { pool } from './db.mjs';

// Admin catalogue upload: POST a GLB (stored + analysed), then POST the product
// with its colours, which all share that one model.
export const admin = Router();
admin.use(requireAdmin);

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const MAX_GLB_MB = 50;
const MM_PER = { mm: 1, cm: 10, in: 25.4 };
const HEX = /^#[0-9A-Fa-f]{6}$/;
const SHA = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COLOURS = 24;

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const skuPart = (s) => s.toUpperCase().normalize('NFKD').replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** The size the GLB reports, in millimetres (glTF axes: x width, y height, z depth). */
function modelDimensionsMm(meta) {
  const size = meta.bbox_m?.size;
  if (!size) return null;
  const mm = (m) => Math.round(m * 10000) / 10;
  return { width: mm(size[0]), height: mm(size[1]), depth: mm(size[2]) };
}

/** Store GLB bytes (deduplicated by hash) and describe them for the uploader. Throws on an invalid GLB. */
async function storeModel(bytes, filename) {
  const meta = glbMeta(bytes);
  const materials = analyzeMaterials(bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await pool.query(
    'INSERT INTO model_blob (sha256, content, size_bytes) VALUES ($1, $2, $3) ON CONFLICT (sha256) DO NOTHING',
    [sha256, bytes, bytes.length],
  );
  return { sha256, filename: filename.slice(0, 255), sizeBytes: bytes.length, meta, materials, dimensionsMm: modelDimensionsMm(meta) };
}

// GET /api/admin/categories
admin.get('/categories', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT id, slug, name FROM category ORDER BY name');
  res.json({ categories: rows });
}));

// POST /api/admin/models   body: raw GLB bytes, header X-Filename (URI-encoded)
// Stores the bytes (deduplicated by SHA-256) and reports what the uploader needs:
// materials with their detected colours, and the model's real-world size.
admin.post('/models', express.raw({ type: () => true, limit: `${MAX_GLB_MB}mb` }), wrap(async (req, res) => {
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || !bytes.length) return res.status(400).json({ error: 'Send the GLB file as the request body.' });
  let filename = 'model.glb';
  try {
    filename = text(decodeURIComponent(req.get('x-filename') ?? '')) ?? filename;
  } catch {
    // malformed header: keep the default
  }
  try {
    glbMeta(bytes); // validate before storing anything
  } catch (err) {
    return res.status(400).json({ error: `Not a valid GLB file: ${err.message}` });
  }
  res.status(201).json(await storeModel(bytes, filename));
}));

// GET /api/admin/models/:sha256: an uploaded (possibly unpublished) GLB, for the admin preview.
admin.get('/models/:sha256', wrap(async (req, res) => {
  if (!SHA.test(req.params.sha256)) return res.status(404).json({ error: 'Not found' });
  const { rows: [blob] } = await pool.query('SELECT content, size_bytes FROM model_blob WHERE sha256 = $1', [req.params.sha256]);
  if (!blob) return res.status(404).json({ error: 'Not found' });
  res.set({ 'Content-Type': 'model/gltf-binary', 'Content-Length': String(blob.size_bytes), 'Cache-Control': 'private, max-age=3600' });
  res.end(blob.content);
}));

// POST /api/admin/models/:sha256/split   { groups: [{ material, nodes: [...], name }], filename }
// Gives the chosen parts their own copy of a material, stores the result as a new
// model and describes it like an upload. The original model is left as it was.
admin.post('/models/:sha256/split', express.json({ limit: '64kb' }), wrap(async (req, res) => {
  if (!SHA.test(req.params.sha256)) return res.status(404).json({ error: 'Model not found' });
  const { rows: [blob] } = await pool.query('SELECT content FROM model_blob WHERE sha256 = $1', [req.params.sha256]);
  if (!blob) return res.status(404).json({ error: 'Model not found; upload it again.' });
  let result;
  try {
    result = splitParts(blob.content, req.body?.groups);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const described = await storeModel(result.glb, text(req.body?.filename) ?? 'model.glb');
  res.status(201).json({ ...described, created: result.created });
}));

/** Returns { value } or { errors: { field: message } }. */
function validateProduct(body = {}) {
  const errors = {};
  const value = {
    name: text(body.name),
    description: text(body.description) ?? '',
    status: body.status === 'draft' ? 'draft' : 'active',
    categoryId: text(body.categoryId),
    newCategory: text(body.newCategory),
    sha256: text(body.model?.sha256),
    filename: text(body.model?.filename) ?? 'model.glb',
    tintMaterials: Array.isArray(body.model?.tintMaterials) ? body.model.tintMaterials : [],
    unit: body.dimensions?.unit ?? 'mm',
    dims: {},
    colours: Array.isArray(body.colours) ? body.colours : [],
  };

  if (!value.name) errors.name = 'Product name is required.';
  else if (value.name.length > 120) errors.name = 'Product name is too long (max 120).';
  if (value.description.length > 2000) errors.description = 'Description is too long (max 2000).';
  if (value.categoryId ? !UUID.test(value.categoryId) : !value.newCategory) errors.category = 'Choose or create a category.';
  else if (value.newCategory && (value.newCategory.length > 60 || !slugify(value.newCategory))) errors.category = 'Category name is invalid.';
  if (!value.sha256 || !SHA.test(value.sha256)) errors.model = 'Upload a GLB model first.';
  if (!value.tintMaterials.every(Number.isInteger)) errors.model = 'Invalid recolourable material list.';

  if (!(value.unit in MM_PER)) errors.dimensions = 'Unit must be mm, cm or in.';
  else {
    for (const axis of ['width', 'height', 'depth']) {
      const raw = body.dimensions?.[axis];
      if (raw === null || raw === undefined || raw === '') continue;
      const mm = Number(raw) * MM_PER[value.unit];
      const label = `${axis[0].toUpperCase()}${axis.slice(1)}`;
      if (!Number.isFinite(mm) || mm <= 0) errors.dimensions = `${label} must be a positive number.`;
      else if (mm > 100_000) errors.dimensions = `${label} is too large: the limit is 100 m.`;
      else value.dims[axis] = Math.round(mm * 10) / 10;
    }
  }

  if (!value.colours.length) errors.colours = 'Add at least one colour.';
  else if (value.colours.length > MAX_COLOURS) errors.colours = `At most ${MAX_COLOURS} colours.`;
  else {
    const seen = new Set();
    value.colours = value.colours.map((c, i) => {
      const colour = {
        name: text(c?.name),
        hex: text(c?.hex)?.toUpperCase() ?? null,
        fabric: text(c?.fabric),
        sku: text(c?.sku)?.toUpperCase() ?? null,
        isDefault: c?.isDefault === true,
      };
      const where = `Colour ${i + 1}`;
      if (!colour.name || colour.name.length > 80) errors.colours = `${where}: name is required (max 80).`;
      else if (seen.has(colour.name.toLowerCase())) errors.colours = `Colour "${colour.name}" is listed twice.`;
      else if (colour.hex && !HEX.test(colour.hex)) errors.colours = `${where}: colour must look like #1E4FD8.`;
      else if (colour.fabric && colour.fabric.length > 80) errors.colours = `${where}: fabric is too long (max 80).`;
      else if (colour.sku && !/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(colour.sku)) errors.colours = `${where}: SKU may use A–Z, 0–9 and single hyphens.`;
      if (colour.name) seen.add(colour.name.toLowerCase());
      return colour;
    });
  }
  return Object.keys(errors).length ? { errors } : { value };
}

/** `base`, or `base-2`, `base-3`… whichever is free in `taken` (a Set, updated). */
function firstFree(base, taken) {
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}`;
  taken.add(candidate);
  return candidate;
}

// POST /api/admin/products
admin.post('/products', express.json({ limit: '64kb' }), wrap(async (req, res) => {
  const { value: v, errors } = validateProduct(req.body);
  if (errors) return res.status(400).json({ error: 'Please fix the highlighted fields.', errors });

  const { rows: [blob] } = await pool.query('SELECT content FROM model_blob WHERE sha256 = $1', [v.sha256]);
  if (!blob) return res.status(400).json({ error: 'Model not found; upload it again.', errors: { model: 'Upload the GLB again.' } });

  // Recompute from the stored bytes: nothing about the model is taken from the client but the choice.
  const meta = glbMeta(blob.content);
  let tint;
  try {
    tint = buildTint(analyzeMaterials(blob.content), v.tintMaterials);
  } catch (err) {
    return res.status(400).json({ error: err.message, errors: { model: err.message } });
  }
  if (!tint && v.colours.length > 1) {
    return res.status(400).json({
      error: 'Pick the recolourable part of the model to offer more than one colour.',
      errors: { colours: 'Select a recolourable material first.' },
    });
  }
  const defaultIndex = Math.max(0, v.colours.findIndex((c) => c.isDefault));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let categoryId = v.categoryId;
    if (!categoryId) {
      const { rows: [cat] } = await client.query(
        `INSERT INTO category (slug, name) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`,
        [slugify(v.newCategory), v.newCategory],
      );
      categoryId = cat.id;
    } else if (!(await client.query('SELECT 1 FROM category WHERE id = $1', [categoryId])).rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Category not found.', errors: { category: 'Category not found.' } });
    }

    const base = slugify(v.name) || 'product';
    const { rows: slugRows } = await client.query('SELECT slug FROM product WHERE slug = $1 OR slug LIKE $2', [base, `${base}-%`]);
    const slug = firstFree(base, new Set(slugRows.map((r) => r.slug)));

    const { rows: [product] } = await client.query(
      `INSERT INTO product (category_id, slug, name, description, status, width_mm, height_mm, depth_mm, dimension_unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [categoryId, slug, v.name, v.description, v.status, v.dims.width ?? null, v.dims.height ?? null, v.dims.depth ?? null, v.unit],
    );

    const skuBase = skuPart(slug).slice(0, 24).replace(/-+$/, '');
    const { rows: skuRows } = await client.query('SELECT sku FROM product_variant WHERE sku LIKE $1', [`${skuBase}-%`]);
    const takenSkus = new Set(skuRows.map((r) => r.sku));

    const variants = [];
    for (const [i, c] of v.colours.entries()) {
      const sku = c.sku ?? firstFree(`${skuBase}-${skuPart(c.name) || i + 1}`, takenSkus);
      const { rows: [variant] } = await client.query(
        `INSERT INTO product_variant (product_id, sku, name, material, color_hex, is_default, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, sku, name`,
        [product.id, sku, c.name, c.fabric, tint ? (c.hex ?? tint.baseHex) : null, i === defaultIndex, i],
      );
      await client.query(
        `INSERT INTO model_asset (variant_id, blob_sha256, version, is_current, original_filename, meta, tint)
         VALUES ($1, $2, 1, true, $3, $4, $5)`,
        [variant.id, v.sha256, v.filename.slice(0, 255), JSON.stringify(meta), tint && JSON.stringify(tint)],
      );
      variants.push({ ...variant, isDefault: i === defaultIndex });
    }

    await client.query('COMMIT');
    res.status(201).json({ product: { id: product.id, slug, status: v.status }, variants });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A SKU or colour name is already in use.', errors: { colours: 'A SKU is already in use; change it or leave it blank.' } });
    }
    throw err;
  } finally {
    client.release();
  }
}));
