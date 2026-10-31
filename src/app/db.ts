import { createDb, type Db } from '../db/client';
import { appUrl } from '../db/urls';

const globalForDb = globalThis as unknown as { __rfpDb?: Db };

/** One shared handle per server process (survives hot reloads in dev). */
export function getDb(): Db {
  globalForDb.__rfpDb ??= createDb(appUrl(), 5).db;
  return globalForDb.__rfpDb;
}
