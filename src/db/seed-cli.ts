import { loadFixtures } from '../fixtures/load';
import { createDb } from './client';
import { resetTables } from './reset';
import { appUrl } from './urls';

const { db, client, close } = createDb(appUrl(), 1);
try {
  await resetTables(client);
  await loadFixtures(db);
  const rows = await client`SELECT (SELECT count(*)::int FROM library_entries) AS entries, (SELECT count(*)::int FROM questions) AS questions`;
  console.log(`seeded mock fixtures: ${rows[0]!.entries} entries, ${rows[0]!.questions} questions`);
} finally {
  await close();
}
