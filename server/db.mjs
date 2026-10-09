import pg from 'pg';
import { databaseUrl } from '../db/scripts/lib.mjs';

// BIGINT (size_bytes) arrives as a string by default; sizes here fit a JS number.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: databaseUrl(), max: 5 });
