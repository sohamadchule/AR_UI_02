import { Router } from 'express';
import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { requireAdmin } from './auth.mjs';
import { pool } from './db.mjs';
import { sendConfirmation, sendTeamNotification, sendVerification } from './mailer.mjs';
import { resolveBaseUrl } from './url.mjs';

export const demo = Router();
demo.use(express.json({ limit: '16kb' }));

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

/** Trimmed string, or null when empty / not a string. */
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Returns { value } or { errors: { field: message } }. */
export function validateDemoRequest(body = {}) {
  const value = {
    name: text(body.name),
    email: text(body.email)?.toLowerCase() ?? null,
    company: text(body.company),
    phone: text(body.phone),
    role: text(body.role),
    interest: text(body.interest),
    message: text(body.message),
  };
  const errors = {};
  if (!value.name) errors.name = 'Please enter your name.';
  else if (value.name.length > 120) errors.name = 'Name is too long.';
  if (!value.email || value.email.length > 254 || !EMAIL.test(value.email)) errors.email = 'Please enter a valid email.';
  if (!value.company) errors.company = 'Please enter your company.';
  else if (value.company.length > 160) errors.company = 'Company name is too long.';
  if (value.phone && !/^\+?[\d\s().-]{7,20}$/.test(value.phone)) errors.phone = 'Please enter a valid phone number.';
  else if (value.phone && value.phone.replace(/\D/g, '').length < 7) errors.phone = 'Please enter a valid phone number.';
  if (value.role && value.role.length > 120) errors.role = 'Role is too long.';
  if (value.interest && value.interest.length > 120) errors.interest = 'Too long.';
  if (value.message && value.message.length > 2000) errors.message = 'Message is too long (max 2000 characters).';
  return Object.keys(errors).length ? { errors } : { value };
}

// Naive in-memory limiter: 5 submissions per IP per 10 minutes.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 5) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

const STATUSES = ['new', 'contacted', 'closed'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Repeat requests (same email + same interest) inside this window get no confirmation mail.
const cooldownHours = () => Number(process.env.DEMO_MAIL_COOLDOWN_HOURS) || 24;

const sha256 = (v) => createHash('sha256').update(v).digest('hex');
const TOKEN_TTL_HOURS = 72; // longer than any cooldown, so a suppressed resend can't strand the visitor

const mxCache = new Map();
/**
 * Can this email's domain receive mail? Only a definite "no such domain / no mail records"
 * rejects; DNS hiccups (timeouts, SERVFAIL) let the address through to the link check.
 */
async function domainReceivesMail(email) {
  const domain = email.split('@')[1];
  const hit = mxCache.get(domain);
  if (hit && hit.until > Date.now()) return hit.ok;
  let ok;
  try {
    const mx = await dns.resolveMx(domain);
    ok = mx.length > 0 && !(mx.length === 1 && mx[0].exchange === '');
  } catch (e) {
    if (e.code !== 'ENODATA' && e.code !== 'ENOTFOUND') return true;
    // No MX: RFC 5321 falls back to the domain's own address record.
    ok = await dns.resolve4(domain).then((a) => a.length > 0, () => dns.resolve6(domain).then((a) => a.length > 0, () => false));
  }
  mxCache.set(domain, { ok, until: Date.now() + 10 * 60_000 });
  return ok;
}

/** After the email is verified: alert the team and confirm to the requester (unless it's a repeat). */
async function finalize(row) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM demo_request
      WHERE email = $1 AND coalesce(interest, '') = coalesce($2, '') AND id <> $3
        AND confirmation_sent AND created_at > now() - make_interval(hours => $4)
      LIMIT 1`,
    [row.email, row.interest, row.id, cooldownHours()],
  );
  const repeat = rowCount > 0;
  const [team, confirmation] = await Promise.allSettled([
    sendTeamNotification(row, { repeat }),
    repeat ? Promise.resolve(false) : sendConfirmation(row),
  ]);
  for (const r of [team, confirmation]) if (r.status === 'rejected') console.error('[mail] failed:', r.reason?.message ?? r.reason);
  if (confirmation.status === 'fulfilled' && confirmation.value) {
    await pool.query('UPDATE demo_request SET confirmation_sent = true WHERE id = $1', [row.id]);
  }
}

// POST /api/demo-requests
demo.post('/', wrap(async (req, res) => {
  // Honeypot: bots fill the hidden field. Pretend success, store nothing.
  if (text(req.body?.website)) return res.status(201).json({ ok: true, verification: 'sent' });
  if (limited(req.ip)) return res.status(429).json({ error: 'Too many requests. Please try again later.' });

  const { value, errors } = validateDemoRequest(req.body);
  if (errors) return res.status(400).json({ error: 'Invalid request', errors });
  if (!(await domainReceivesMail(value.email))) {
    return res.status(400).json({ error: 'Invalid request', errors: { email: "This email domain can't receive mail. Please check the address." } });
  }

  // Already verified earlier? Then this request is trusted straight away.
  const known = (await pool.query('SELECT 1 FROM demo_request WHERE email = $1 AND email_verified_at IS NOT NULL LIMIT 1', [value.email])).rowCount > 0;
  // A recent pending request for the same thing already has a live link in the inbox: don't mail again.
  const resent = !known && (await pool.query(
    `SELECT 1 FROM demo_request
      WHERE email = $1 AND coalesce(interest, '') = coalesce($2, '') AND email_verified_at IS NULL
        AND verify_expires_at > now() AND created_at > now() - make_interval(hours => $3)
      LIMIT 1`,
    [value.email, value.interest, cooldownHours()],
  )).rowCount > 0;

  const token = known || resent ? null : randomBytes(32).toString('hex');
  const { rows } = await pool.query(
    `INSERT INTO demo_request (name, email, company, phone, role, interest, message, email_verified_at, verify_token_hash, verify_expires_at)
     VALUES ($1,$2,$3,$10,$4,$5,$6, $7::timestamptz, $8::text, CASE WHEN $8::text IS NULL THEN NULL ELSE now() + make_interval(hours => $9) END)
     RETURNING id`,
    [value.name, value.email, value.company, value.role, value.interest, value.message, known ? new Date() : null, token && sha256(token), TOKEN_TTL_HOURS, value.phone],
  );
  const row = { id: rows[0].id, ...value };
  res.status(201).json({ ok: true, id: row.id, verification: known ? 'verified' : 'sent' });

  const job = known
    ? finalize(row)
    : token
      ? sendVerification(row, `${resolveBaseUrl(req)}/request-demo/verify?token=${token}`)
      : Promise.resolve();
  job.catch((e) => console.error('[mail] failed:', e.message));
}));

// POST /api/demo-requests/verify { token }: the link in the confirmation email.
demo.post('/verify', wrap(async (req, res) => {
  const token = text(req.body?.token);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return res.status(400).json({ error: 'Invalid link.' });
  const { rows } = await pool.query('SELECT email, email_verified_at, verify_expires_at FROM demo_request WHERE verify_token_hash = $1', [sha256(token)]);
  if (!rows.length) return res.status(400).json({ error: 'This link is not valid.' });
  if (rows[0].email_verified_at) return res.json({ ok: true, already: true });
  if (rows[0].verify_expires_at < new Date()) return res.status(410).json({ error: 'This link has expired. Please submit the form again.' });

  // Verifying the address verifies every pending request from it (oldest first).
  const { rows: verified } = await pool.query(
    `UPDATE demo_request SET email_verified_at = now()
      WHERE email = $1 AND email_verified_at IS NULL
      RETURNING id, name, email, company, phone, role, interest, message, created_at`,
    [rows[0].email],
  );
  res.json({ ok: true });
  (async () => {
    for (const r of verified.sort((a, b) => a.created_at - b.created_at)) await finalize(r);
  })().catch((e) => console.error('[mail] failed:', e.message));
}));

// GET /api/demo-requests: team only (Bearer ADMIN_TOKEN). `?check=1` is a cheap token probe.
demo.get('/', requireAdmin, wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM demo_request ORDER BY created_at DESC LIMIT 500');
  res.json({ requests: rows });
}));

// PATCH /api/demo-requests/:id { status }
demo.patch('/:id', requireAdmin, wrap(async (req, res) => {
  const { status } = req.body ?? {};
  if (!UUID.test(req.params.id) || !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid request' });
  const { rows } = await pool.query('UPDATE demo_request SET status = $2 WHERE id = $1 RETURNING *', [req.params.id, status]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ request: rows[0] });
}));
