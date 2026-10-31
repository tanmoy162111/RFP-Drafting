import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTest, resetTables } from '../db/test-db';
import { screenEvidence } from '../domain/injection';
import { routeQuestion } from '../domain/routing';
import { NOW } from '../domain/test-helpers';
import { ANSWER_KEY, HELD_OUT_DOCUMENTS } from '../fixtures/held-out';
import { loadFixtures } from '../fixtures/load';
import { parseDocument } from '../ingest/parse-document';
import { retrieve } from './retrieve';

const { client, db, close } = connectTest();
afterAll(close);
beforeAll(async () => {
  await resetTables(client);
  await loadFixtures(db);
});

const questionTexts = new Map<string, string>();
for (const doc of HELD_OUT_DOCUMENTS) {
  for (const item of parseDocument(doc.text)) {
    if (item.kind === 'question') questionTexts.set(`${doc.slug}:${item.ordinal}`, item.text);
  }
}

/** Why each trap must go to a person. Unanswerable questions are always no_evidence. */
const TRAP_REASONS: Record<string, string> = {
  'fabrikam-rfp:2': 'conflict',
  'fabrikam-rfp:9': 'stale',
  'fabrikam-questionnaire:10': 'no_evidence',
};

describe('every held-out question routes as its answer key expects', () => {
  it('covers all 65 questions', () => {
    expect(ANSWER_KEY).toHaveLength(65);
  });

  it.each(ANSWER_KEY.map((k) => [k.questionId, k] as const))('%s', async (_id, item) => {
    const text = questionTexts.get(item.questionId)!;
    const { clean } = screenEvidence(await retrieve(db, text));
    const result = routeQuestion(clean, NOW);
    if (item.supported && !item.trap) {
      expect(result.status).toBe('draftable');
    } else {
      expect(result).toMatchObject({ status: 'needs_human', reason: TRAP_REASONS[item.questionId] ?? 'no_evidence' });
    }
  });
});
