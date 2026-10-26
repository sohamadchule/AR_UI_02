import { timingSafeEqual } from 'node:crypto';

/** True when the request carries `Authorization: Bearer <ADMIN_TOKEN>`. */
function isAdmin(req) {
  const token = process.env.ADMIN_TOKEN;
  const given = /^Bearer (.+)$/.exec(req.get('authorization') ?? '')?.[1];
  if (!token || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const requireAdmin = (req, res, next) => (isAdmin(req) ? next() : res.status(401).json({ error: 'Unauthorized' }));
