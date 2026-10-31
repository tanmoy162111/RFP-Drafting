import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

export function createDb(url: string, max = 5): { db: Db; client: Sql; close: () => Promise<void> } {
  const client = postgres(url, { max, onnotice: () => {} });
  return { db: drizzle(client, { schema }), client, close: () => client.end() };
}
