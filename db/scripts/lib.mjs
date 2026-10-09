import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

export const DB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal .env loader (no dependency); real environment variables win. */
function loadEnv() {
  try {
    const text = readFileSync(join(DB_DIR, '..', '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    // No .env file: rely on the real environment.
  }
}

export function databaseUrl() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see .env.example).');
  return url;
}

export function connect(url = databaseUrl()) {
  return new pg.Client({ connectionString: url });
}

/** Same server, different database name. */
export function withDatabase(url, name) {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}
