import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTest, resetTables } from '../db/test-db';
import { MockDraftProvider } from '../drafting/mock-provider';
import { loadFixtures } from '../fixtures/load';
import { EVAL_NOW } from './config';
import { allGatesPass, runEval, type EvalResult } from './run';

const { client, db, close } = connectTest();
afterAll(close);

let result: EvalResult;
beforeAll(async () => {
  await resetTables(client);
  await loadFixtures(db);
  result = await runEval(db, new MockDraftProvider(), EVAL_NOW);
});

describe('eval with the mock provider', () => {
  it('passes every hard gate', () => {
    expect(result.gates.filter((g) => !g.pass)).toEqual([]);
    expect(allGatesPass(result)).toBe(true);
  });

  it('drafts 55 of 65 questions and routes 10 to a person', () => {
    expect(result.metrics.drafted).toBe(55);
    expect(result.items.filter((i) => i.status === 'needs_human')).toHaveLength(10);
    expect(result.humanByReason).toEqual({ conflict: 1, no_evidence: 8, stale: 1 });
  });

  it('routes every trap and unanswerable question to a person', () => {
    const guarded = result.items.filter((i) => i.guarded);
    expect(guarded).toHaveLength(10);
    expect(guarded.every((i) => i.status === 'needs_human')).toBe(true);
  });

  it('accepts most extractive drafts without edits (baseline, not a gate)', () => {
    expect(result.metrics.acceptedRate).toBeGreaterThanOrEqual(0.85);
  });

  it('records 0 wrong facts and full citation coverage', () => {
    expect(result.metrics.wrongFactCount).toBe(0);
    expect(result.metrics.citationCoverage).toBe(1);
  });
});
