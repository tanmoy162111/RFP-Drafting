import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { adminUrl, testUrl } from './urls';

/** Drops and recreates the test database, then applies all migrations. Runs once per `pnpm test:db`. */
export default async function setup(): Promise<void> {
  const dbName = new URL(testUrl()).pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(dbName)) throw new Error(`unsafe test database name: ${dbName}`);

  const admin = postgres(adminUrl(), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  } catch (error) {
    throw new Error(`Cannot reach Postgres at ${adminUrl()}. Run "pnpm db:up" first. (${String(error)})`);
  } finally {
    await admin.end();
  }

  const client = postgres(testUrl(), { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  } finally {
    await client.end();
  }
}
