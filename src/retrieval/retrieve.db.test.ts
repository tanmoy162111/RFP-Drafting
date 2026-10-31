import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTest, resetTables } from '../db/test-db';
import { DEFAULT_CONFIG } from '../domain/config';
import { routeQuestion } from '../domain/routing';
import { screenEvidence } from '../domain/injection';
import { NOW } from '../domain/test-helpers';
import { loadFixtures } from '../fixtures/load';
import { HELD_OUT_DOCUMENTS } from '../fixtures/held-out';
import { parseDocument } from '../ingest/parse-document';
import { retrieve } from './retrieve';

const { client, db, close } = connectTest();
afterAll(close);
beforeAll(async () => {
  await resetTables(client);
  await loadFixtures(db);
});

const questionText = (slug: string, ordinal: number): string => {
  const doc = HELD_OUT_DOCUMENTS.find((d) => d.slug === slug)!;
  const item = parseDocument(doc.text).find((i) => i.ordinal === ordinal)!;
  if (item.kind !== 'question') throw new Error('expected a parsed question');
  return item.text;
};

describe('retrieve', () => {
  it('ranks the encryption entry first for the encryption question', async () => {
    const evidence = await retrieve(db, questionText('fabrikam-rfp', 1));
    expect(evidence[0]!.text).toContain('AES-256');
    expect(evidence[0]!.text).toContain('TLS 1.3');
    expect(evidence[0]!.score).toBeGreaterThanOrEqual(DEFAULT_CONFIG.scoreFloor);
  });

  it('returns Evidence with source status, review date and facts', async () => {
    const evidence = await retrieve(db, questionText('fabrikam-questionnaire', 8));
    expect(evidence[0]).toMatchObject({
      sourceStatus: 'approved',
      lastReviewedAt: '2026-08-20',
      facts: [{ key: 'iso27001_expiry', value: '2027-06-30' }],
    });
  });

  it('returns both conflicting SOC 2 entries above the score floor', async () => {
    const evidence = await retrieve(db, questionText('fabrikam-rfp', 2));
    const soc2 = evidence.filter((e) => e.facts.some((f) => f.key === 'soc2_report_date'));
    expect(soc2.map((e) => e.score).every((s) => s >= DEFAULT_CONFIG.scoreFloor)).toBe(true);
    expect(soc2.map((e) => e.facts[0]!.value).sort()).toEqual(['2024-03-31', '2025-03-31']);
  });

  it('surfaces the deprecated pricing entry for the pricing question', async () => {
    const evidence = await retrieve(db, questionText('fabrikam-rfp', 9));
    expect(evidence[0]).toMatchObject({ sourceStatus: 'deprecated' });
  });

  it('respects the limit', async () => {
    expect(await retrieve(db, 'customer data', 3)).toHaveLength(3);
  });

  it('scores unanswerable questions below the floor', async () => {
    for (const [slug, ordinal] of [['fabrikam-rfp', 10], ['fabrikam-questionnaire', 11]] as const) {
      const evidence = await retrieve(db, questionText(slug, ordinal));
      expect(evidence[0]!.score).toBeLessThan(DEFAULT_CONFIG.scoreFloor);
    }
  });
});

describe('retrieve feeding routeQuestion', () => {
  const draftable: [string, number][] = [
    ['fabrikam-rfp', 1], ['fabrikam-rfp', 3], ['fabrikam-rfp', 4], ['fabrikam-rfp', 5],
    ['fabrikam-rfp', 6], ['fabrikam-rfp', 7], ['fabrikam-rfp', 8],
    ['fabrikam-questionnaire', 1], ['fabrikam-questionnaire', 2], ['fabrikam-questionnaire', 3],
    ['fabrikam-questionnaire', 4], ['fabrikam-questionnaire', 5], ['fabrikam-questionnaire', 6],
    ['fabrikam-questionnaire', 7], ['fabrikam-questionnaire', 8], ['fabrikam-questionnaire', 9],
    ['fabrikam-questionnaire', 12],
  ];

  it.each(draftable)('%s:%i is draftable', async (slug, ordinal) => {
    const result = routeQuestion(await retrieve(db, questionText(slug, ordinal)), NOW);
    expect(result.status).toBe('draftable');
  });

  it('routes the conflicting SOC 2 question to a human as a conflict', async () => {
    const result = routeQuestion(await retrieve(db, questionText('fabrikam-rfp', 2)), NOW);
    expect(result).toMatchObject({ status: 'needs_human', reason: 'conflict' });
  });

  it('routes the deprecated-pricing question to a human as stale', async () => {
    const result = routeQuestion(await retrieve(db, questionText('fabrikam-rfp', 9)), NOW);
    expect(result).toMatchObject({ status: 'needs_human', reason: 'stale' });
  });

  it('routes the unanswerable questions to a human as no_evidence', async () => {
    for (const [slug, ordinal] of [['fabrikam-rfp', 10], ['fabrikam-questionnaire', 11]] as const) {
      const result = routeQuestion(await retrieve(db, questionText(slug, ordinal)), NOW);
      expect(result).toMatchObject({ status: 'needs_human', reason: 'no_evidence' });
    }
  });

  it('routes the FedRAMP question to a human once the injected text is screened out', async () => {
    const { clean, flagged } = screenEvidence(await retrieve(db, questionText('fabrikam-questionnaire', 10)));
    expect(flagged.length).toBeGreaterThan(0);
    expect(routeQuestion(clean, NOW)).toMatchObject({ status: 'needs_human', reason: 'no_evidence' });
  });
});
