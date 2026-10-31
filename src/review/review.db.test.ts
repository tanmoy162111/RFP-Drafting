import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTest, resetTables } from '../db/test-db';
import { ExportRefusedError } from '../domain/approval';
import { MockDraftProvider } from '../drafting/mock-provider';
import { draftDocument } from '../drafting/run';
import { EVAL_NOW } from '../eval/config';
import { HELD_OUT_DOCUMENTS } from '../fixtures/held-out';
import { loadFixtures } from '../fixtures/load';
import { recordReview, ReviewError } from './decide';
import { ExportNotRecordedError, exportDocument, exportSheet } from './export';
import { getReviewDocument, listDocuments } from './queries';
import { exportState } from './stats';
import type { DocumentView, QuestionView } from './types';

const { client, db, close } = connectTest();
afterAll(close);

const SLUG = 'fabrikam-rfp';
const REVIEWER = 'test reviewer';

beforeEach(async () => {
  await resetTables(client);
  await loadFixtures(db);
  for (const doc of HELD_OUT_DOCUMENTS) await draftDocument(db, new MockDraftProvider(), doc.slug, EVAL_NOW);
});

const load = async (): Promise<DocumentView> => (await getReviewDocument(db, SLUG))!;
const at = (view: DocumentView, ordinal: number): QuestionView => view.questions.find((q) => q.ordinal === ordinal)!;
const count = async (table: string): Promise<number> =>
  (await client.unsafe(`SELECT count(*)::int AS n FROM ${table}`))[0]!.n as number;

/** Accept every drafted answer and reject every question that needs a person. */
async function reviewEverything(): Promise<void> {
  for (const q of (await load()).questions) {
    await recordReview(db, {
      draftId: q.draft!.id,
      decision: q.draft!.status === 'draftable' ? 'accept' : 'reject',
      reviewer: REVIEWER,
    });
  }
}

describe('queries', () => {
  it('lists both documents with their counts', async () => {
    const documents = await listDocuments(db);
    const rfp = documents.find((d) => d.slug === SLUG)!;
    expect(documents).toHaveLength(2);
    expect(rfp).toMatchObject({ total: 25, draftable: 20, needsHuman: 5, reviewed: 0, exported: 0 });
    expect(documents.find((d) => d.slug === 'fabrikam-questionnaire')).toMatchObject({ total: 40, draftable: 35, needsHuman: 5 });
  });

  it('returns null for an unknown document', async () => {
    expect(await getReviewDocument(db, 'nope')).toBeNull();
  });

  it('returns a drafted question with its citation and no review', async () => {
    const q = at(await load(), 3);
    expect(q.draft).toMatchObject({ status: 'draftable', reasonCode: null });
    expect(q.draft!.answerText).toContain('retains customer data for 90 days');
    expect(q.citations).toHaveLength(1);
    expect(q.citations[0]).toMatchObject({ sourceTitle: 'Information Security Policy (mock)', topic: 'Data retention' });
    expect(q.review).toBeNull();
  });

  it('returns a question that needs a person with its reason and no citations', async () => {
    const q = at(await load(), 2);
    expect(q.draft).toMatchObject({ status: 'needs_human', reasonCode: 'conflict', answerText: null });
    expect(q.citations).toEqual([]);
  });
});

describe('recordReview', () => {
  it('records an accept with edit distance 0', async () => {
    const q = at(await load(), 3);
    await recordReview(db, { draftId: q.draft!.id, decision: 'accept', reviewer: REVIEWER });
    expect(at(await load(), 3).review).toMatchObject({ decision: 'accept', editDistance: 0, exported: false });
  });

  it('records an edit with its edit distance and text', async () => {
    const q = at(await load(), 3);
    const text = q.draft!.answerText!.replace('90 days', '60 days');
    const result = await recordReview(db, { draftId: q.draft!.id, decision: 'edit', finalText: text, reviewer: REVIEWER });
    expect(result.editDistance).toBe(1);
    expect(at(await load(), 3).review).toMatchObject({ decision: 'edit', finalText: text, editDistance: 1 });
  });

  it('lets a person write an answer for a question that needs one', async () => {
    const q = at(await load(), 2);
    await recordReview(db, { draftId: q.draft!.id, decision: 'edit', finalText: 'Our SOC 2 report is dated 2025-03-31.', reviewer: REVIEWER });
    expect(at(await load(), 2).review).toMatchObject({ decision: 'edit', editDistance: 0 });
  });

  it('refuses an empty edit, accepting a question with no draft text, and an unknown draft', async () => {
    const view = await load();
    await expect(
      recordReview(db, { draftId: at(view, 3).draft!.id, decision: 'edit', finalText: '   ', reviewer: REVIEWER }),
    ).rejects.toMatchObject({ code: 'empty_text' });
    await expect(
      recordReview(db, { draftId: at(view, 2).draft!.id, decision: 'accept', reviewer: REVIEWER }),
    ).rejects.toMatchObject({ code: 'no_draft_text' });
    await expect(
      recordReview(db, { draftId: crypto.randomUUID(), decision: 'accept', reviewer: REVIEWER }),
    ).rejects.toBeInstanceOf(ReviewError);
  });

  it('replaces the earlier review when the reviewer changes their mind', async () => {
    const q = at(await load(), 3);
    await recordReview(db, { draftId: q.draft!.id, decision: 'accept', reviewer: REVIEWER });
    await recordReview(db, { draftId: q.draft!.id, decision: 'reject', reviewer: REVIEWER });
    expect(await count('reviews')).toBe(1);
    expect(at(await load(), 3).review?.decision).toBe('reject');
  });
});

describe('exportDocument', () => {
  it('refuses while any question is unreviewed', async () => {
    const q = at(await load(), 3);
    await recordReview(db, { draftId: q.draft!.id, decision: 'accept', reviewer: REVIEWER });
    await expect(exportDocument(db, SLUG)).rejects.toBeInstanceOf(ExportRefusedError);
    expect(await count('exports')).toBe(0);
  });

  it('records one export per accepted or edited answer and none for rejected ones', async () => {
    await reviewEverything();
    expect(await exportDocument(db, SLUG)).toEqual({ exported: 20 });
    expect(await count('exports')).toBe(20);
    expect(exportState((await load()).questions)).toBe('exported');
  });

  it('is safe to run twice', async () => {
    await reviewEverything();
    await exportDocument(db, SLUG);
    await exportDocument(db, SLUG);
    expect(await count('exports')).toBe(20);
  });

  it('locks reviews once they are exported', async () => {
    await reviewEverything();
    await exportDocument(db, SLUG);
    const q = at(await load(), 3);
    await expect(
      recordReview(db, { draftId: q.draft!.id, decision: 'reject', reviewer: REVIEWER }),
    ).rejects.toMatchObject({ code: 'locked' });
  });

  it('rejects an unknown document', async () => {
    await expect(exportDocument(db, 'nope')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('exportSheet', () => {
  it('refuses until the export has been recorded', async () => {
    await reviewEverything();
    await expect(exportSheet(db, SLUG)).rejects.toBeInstanceOf(ExportNotRecordedError);
  });

  it('refuses while questions are unreviewed', async () => {
    await expect(exportSheet(db, SLUG)).rejects.toBeInstanceOf(ExportRefusedError);
  });

  it('returns a sheet with one row per question once the export is recorded', async () => {
    await reviewEverything();
    await exportDocument(db, SLUG);
    const { csv } = await exportSheet(db, SLUG);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(26);
    expect(lines[0]).toBe('ordinal,section,question,answer,status,sources,label');
    expect(csv.match(/rejected - left for a person/g)).toHaveLength(5);
    expect(csv).toContain('mock - not submitted');
  });
});
