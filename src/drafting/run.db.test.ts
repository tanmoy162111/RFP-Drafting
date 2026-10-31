import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTest, resetTables } from '../db/test-db';
import { NOW } from '../domain/test-helpers';
import { HELD_OUT_DOCUMENTS } from '../fixtures/held-out';
import { loadFixtures } from '../fixtures/load';
import { ingestDocument } from '../ingest/load';
import { MockDraftProvider } from './mock-provider';
import { draftDocument } from './run';

const { client, db, close } = connectTest();
afterAll(close);
beforeEach(() => resetTables(client));

const provider = new MockDraftProvider();

describe('draftDocument', () => {
  it('drafts 55 of 65 held-out questions and routes 10 to a person', async () => {
    await loadFixtures(db);
    for (const doc of HELD_OUT_DOCUMENTS) await draftDocument(db, provider, doc.slug, NOW);

    const byStatus = await client`SELECT status, count(*)::int AS n FROM drafts GROUP BY status ORDER BY status`;
    expect(byStatus.map((r) => [r.status, r.n])).toEqual([['draftable', 55], ['needs_human', 10]]);

    const byReason = await client`
      SELECT reason_code, count(*)::int AS n FROM drafts WHERE status = 'needs_human' GROUP BY reason_code ORDER BY reason_code::text`;
    expect(byReason.map((r) => [r.reason_code, r.n])).toEqual([['conflict', 1], ['no_evidence', 8], ['stale', 1]]);
  });

  it('gives every draftable draft at least one citation and every flagged draft no text', async () => {
    await loadFixtures(db);
    await draftDocument(db, provider, 'fabrikam-questionnaire', NOW);

    const uncited = await client`
      SELECT d.id FROM drafts d LEFT JOIN citations c ON c.draft_id = d.id
      WHERE d.status = 'draftable' GROUP BY d.id HAVING count(c.id) = 0`;
    expect(uncited).toHaveLength(0);
    const leaked = await client`SELECT id FROM drafts WHERE status = 'needs_human' AND answer_text IS NOT NULL`;
    expect(leaked).toHaveLength(0);
  });

  it('replaces earlier drafts when run again', async () => {
    await loadFixtures(db);
    await draftDocument(db, provider, 'fabrikam-rfp', NOW);
    await draftDocument(db, provider, 'fabrikam-rfp', NOW);
    const rows = await client`SELECT count(*)::int AS n FROM drafts`;
    expect(rows[0]!.n).toBe(25);
  });

  it('keeps an unparsed row as a needs_human draft with low_confidence', async () => {
    await loadFixtures(db);
    await ingestDocument(db, {
      slug: 'odd',
      kind: 'rfp',
      title: 'Odd doc (mock)',
      heldOut: false,
      text: '# S\n1. Do you encrypt customer data at rest?\nAppendix B - see attached spreadsheet',
    });
    const results = await draftDocument(db, provider, 'odd', NOW);
    expect(results).toHaveLength(2);
    expect(results[0]!.decision.status).toBe('draftable');
    expect(results[1]!.decision).toMatchObject({ status: 'needs_human', reason: 'low_confidence', detail: ['unparsed_row'] });
  });

  it('rejects an unknown document', async () => {
    await expect(draftDocument(db, provider, 'nope', NOW)).rejects.toThrow('unknown document');
  });
});
