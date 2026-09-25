/**
 * API requests run with pg_safeupdate, which refuses UPDATE or DELETE without a WHERE clause —
 * even on temp tables inside an RPC. SQL tests run without it, so check the migrations here.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const dir = join(__dirname, '../../supabase/migrations');

describe('migrations', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));

  it.each(files)('%s: every UPDATE and DELETE has a WHERE clause', (file) => {
    const sql = readFileSync(join(dir, file), 'utf8').replace(/--[^\n]*/g, '');
    const offenders = [...sql.matchAll(/\b(update\s+\w+(?:\s+\w+)?\s+set\b|delete\s+from\s+\w+)([\s\S]*?);/gi)]
      .filter((m) => !/\bwhere\b/i.test(m[2]!))
      .map((m) => m[0].slice(0, 80).replace(/\s+/g, ' '));
    expect(offenders).toEqual([]);
  });
});
