// A tiny stand-in for Cloudflare D1 built on Node's SQLite, so tests run the real SQL.
import { readFileSync, readdirSync } from 'node:fs';

export async function createDb() {
  let DatabaseSync;
  try { ({ DatabaseSync } = await import('node:sqlite')); } catch { return null; }
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).sort()) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  const wrap = (sql, args = []) => ({
    bind: (...next) => wrap(sql, next),
    run: async () => { const r = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: r.changes } }; },
    all: async () => ({ results: sqlite.prepare(sql).all(...args) })
  });
  return {
    sqlite,
    prepare: sql => wrap(sql),
    // D1 runs a batch as one transaction: if one statement fails, all of them roll back.
    batch: async statements => {
      sqlite.exec('BEGIN');
      try { for (const s of statements) await s.run(); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  };
}
