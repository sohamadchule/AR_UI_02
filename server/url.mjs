import { networkInterfaces } from 'node:os';

const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0)$/i;

/** First private IPv4 address of this machine (what a phone on the same Wi-Fi can reach). */
function lanAddress() {
  const candidates = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) candidates.push(a.address);
    }
  }
  const isPrivate = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  return candidates.find(isPrivate) ?? candidates[0] ?? null;
}

/**
 * Public base URL (scheme + host, no trailing slash), used for the QR target.
 * Precedence: PUBLIC_BASE_URL, then proxy headers / the request's own host.
 * A loopback host (localhost) is unreachable from a phone, so it is swapped for
 * this machine's LAN address, keeping the port the browser used.
 */
export function resolveBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.trim().replace(/\/+$/, '');
  const host = req.get('x-forwarded-host') ?? req.get('host') ?? '';
  const proto = req.get('x-forwarded-proto') ?? req.protocol;
  const [hostname, port] = host.replace(/^\[|\]$/g, '').split(/:(?=\d+$)/);
  if (LOOPBACK.test(hostname)) {
    const lan = lanAddress();
    if (lan) return `${proto}://${lan}${port ? `:${port}` : ''}`;
  }
  return `${proto}://${host}`;
}

/** The stable public page for a variant. This, and only this, is what a QR encodes. */
export const buildViewUrl = (req, variantId) => `${resolveBaseUrl(req)}/view/${variantId}`;
