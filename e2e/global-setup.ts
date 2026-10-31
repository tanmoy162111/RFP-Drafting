import setup from '../src/db/global-setup';
import { E2E_URL } from './env';

/** Drops, recreates and migrates the e2e database. Reuses the Vitest DB setup by pointing it at the e2e URL. */
export default async function globalSetup(): Promise<void> {
  process.env.TEST_DATABASE_URL = E2E_URL;
  await setup();
}
