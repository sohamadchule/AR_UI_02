// Sanity checks for the database: byte-exact storage and enforced invariants.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DB_DIR, connect } from './lib.mjs';

const db = connect();
await db.connect();
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
};

// Rejects `sql`; runs in a savepoint so one expected error does not abort the rest.
async function rejects(label, sql, params = []) {
  await db.query('SAVEPOINT t');
  try {
    await db.query(sql, params);
    check(false, label);
  } catch (e) {
    check(true, `${label} -> ${e.constraint ?? e.code}`);
  }
  await db.query('ROLLBACK TO SAVEPOINT t');
}

try {
  // 1. Stored bytes are identical to the source files.
  const { rows } = await db.query(
    `SELECT a.original_filename AS file, b.sha256, b.size_bytes, b.content
       FROM model_asset a JOIN model_blob b ON b.sha256 = a.blob_sha256 WHERE a.is_current`,
  );
  check(rows.length === 3, `3 current models stored (found ${rows.length})`);
  for (const r of rows) {
    const src = readFileSync(join(DB_DIR, 'seed', 'models', r.file));
    const ok = createHash('sha256').update(r.content).digest('hex') === r.sha256 && Buffer.compare(src, r.content) === 0;
    check(ok, `byte-exact round trip: ${r.file} (${r.size_bytes} bytes)`);
  }

  // 2. Catalog view returns what the app needs, without the bytes.
  const view = await db.query('SELECT sku, variant_name, model_version, model_size_bytes, meta->\'bbox_m\'->\'size\' AS size_m FROM v_variant_current_model ORDER BY sku');
  console.table(view.rows.map((r) => ({ ...r, size_m: JSON.stringify(r.size_m) })));

  // 3. Invariants.
  await db.query('BEGIN');
  const v = (await db.query("SELECT id FROM product_variant WHERE sku = 'LAMP-STD'")).rows[0].id;
  await rejects('rejects non-GLB bytes', "INSERT INTO model_blob (sha256, content, size_bytes) VALUES (repeat('a',64), 'hello'::bytea, 5)");
  await rejects('rejects a wrong size_bytes', "INSERT INTO model_blob (sha256, content, size_bytes) VALUES (repeat('b',64), '\\x676c544600'::bytea, 99)");
  await rejects(
    'rejects a second current model for a variant',
    `INSERT INTO model_asset (variant_id, blob_sha256, version, is_current, original_filename)
     SELECT variant_id, blob_sha256, 2, true, 'x.glb' FROM model_asset WHERE variant_id = $1`,
    [v],
  );
  await rejects('rejects a duplicate slug', "INSERT INTO product (category_id, slug, name) SELECT category_id, slug, 'dup' FROM product LIMIT 1");
  await rejects('rejects a malformed slug', "INSERT INTO product (category_id, slug, name) SELECT id, 'Bad Slug', 'x' FROM category LIMIT 1");
  await rejects('rejects a second default variant', "INSERT INTO product_variant (product_id, sku, name, is_default) SELECT product_id, 'LAMP-X', 'X', true FROM product_variant WHERE sku = 'LAMP-STD'");
  await rejects('refuses to delete a referenced blob', 'DELETE FROM model_blob');
  await db.query('ROLLBACK');
} finally {
  await db.end();
}
process.exit(failures ? 1 : 0);
