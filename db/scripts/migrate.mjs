// Applies db/migrations/*.sql in order. Each file runs in its own transaction and
// is recorded with a checksum so edited history is detected, not silently skipped.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DB_DIR, connect } from './lib.mjs';

const dir = join(DB_DIR, 'migrations');
const files = readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();

const db = connect();
await db.connect();
try {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     text        PRIMARY KEY,
      checksum    text        NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )`);
  const applied = new Map((await db.query('SELECT version, checksum FROM schema_migrations')).rows.map((r) => [r.version, r.checksum]));

  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8');
    const hash = (text) => createHash('sha256').update(text).digest('hex');
    const checksum = hash(sql);
    if (applied.has(file)) {
      // Git's autocrlf may check a file out with other line endings than it was applied with: not an edit.
      const lf = sql.replace(/\r\n/g, '\n');
      const same = [checksum, hash(lf), hash(lf.replace(/\n/g, '\r\n'))].includes(applied.get(file));
      if (!same) throw new Error(`Migration ${file} was modified after being applied.`);
      console.log(`skip   ${file}`);
      continue;
    }
    await db.query('BEGIN');
    try {
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file, checksum]);
      await db.query('COMMIT');
      console.log(`apply  ${file}`);
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  }
} finally {
  await db.end();
}
