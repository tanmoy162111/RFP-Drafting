import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { testUrl } from './urls';

/** One connection to the test database: raw `client` for SQL, `db` for Drizzle. */
export function connectTest() {
  const client = postgres(testUrl(), { max: 1, onnotice: () => {} });
  return { client, db: drizzle(client, { schema }), close: () => client.end() };
}

export { resetTables } from './reset';
