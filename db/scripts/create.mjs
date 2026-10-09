// Creates the application database if it does not exist yet.
import { connect, databaseUrl, withDatabase } from './lib.mjs';

const url = databaseUrl();
const target = decodeURIComponent(new URL(url).pathname.slice(1));
if (!/^[a-z_][a-z0-9_]*$/.test(target)) throw new Error(`Unsafe database name: ${target}`);

// Connect to the maintenance database to issue CREATE DATABASE.
const admin = connect(withDatabase(url, 'postgres'));
await admin.connect();
try {
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [target]);
  if (rowCount) {
    console.log(`database "${target}" already exists`);
  } else {
    await admin.query(`CREATE DATABASE ${target} ENCODING 'UTF8'`);
    console.log(`created database "${target}"`);
  }
} finally {
  await admin.end();
}
