import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { appUrl } from './urls';

const client = postgres(appUrl(), { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  console.log('migrations applied');
} finally {
  await client.end();
}
