import type { Sql } from 'postgres';
import { createDb, type Db } from '../src/db/client';
import { resetTables } from '../src/db/reset';
import { MockDraftProvider } from '../src/drafting/mock-provider';
import { draftDocument } from '../src/drafting/run';
import { EVAL_NOW } from '../src/eval/config';
import { HELD_OUT_DOCUMENTS } from '../src/fixtures/held-out';
import { loadFixtures } from '../src/fixtures/load';
import { recordReview } from '../src/review/decide';
import { getReviewDocument } from '../src/review/queries';
import { E2E_URL } from './env';

async function withDb<T>(fn: (db: Db, client: Sql) => Promise<T>): Promise<T> {
  const { db, client, close } = createDb(E2E_URL, 1);
  try {
    return await fn(db, client);
  } finally {
    await close();
  }
}

/** Empties the e2e database, loads the mock fixtures and drafts both documents with the mock provider. */
export async function resetAndSeed(): Promise<void> {
  await withDb(async (db, client) => {
    await resetTables(client);
    await loadFixtures(db);
    for (const doc of HELD_OUT_DOCUMENTS) await draftDocument(db, new MockDraftProvider(), doc.slug, EVAL_NOW);
  });
}

/** Reviews every question of a document except one: accepts drafts, rejects questions that need a person. */
export async function reviewAllExcept(slug: string, exceptOrdinal: number): Promise<void> {
  await withDb(async (db) => {
    const view = await getReviewDocument(db, slug);
    for (const q of view!.questions) {
      if (q.ordinal === exceptOrdinal) continue;
      await recordReview(db, {
        draftId: q.draft!.id,
        decision: q.draft!.status === 'draftable' ? 'accept' : 'reject',
        reviewer: 'e2e',
      });
    }
  });
}
