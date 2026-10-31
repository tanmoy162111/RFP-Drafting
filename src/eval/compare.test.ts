import { describe, it, expect } from 'vitest';
import { compareResults } from './compare';
import type { EvalResult } from './run';

const result = (provider: string, overrides: Partial<EvalResult> = {}): EvalResult => ({
  provider,
  now: '2026-10-31',
  metrics: { drafted: 2, acceptedRate: 1, citationCoverage: 1, correctRouting: 1, wrongFactCount: 0, hoursSavedEstimate: 0.67 },
  gates: [{ name: 'Wrong facts', pass: true, actual: 0, required: '= 0' }],
  humanByReason: { no_evidence: 1 },
  items: [
    { key: 'a:1', question: 'Q1?', status: 'draftable', accepted: true, wrongFact: false, guarded: false },
    { key: 'a:2', question: 'Q2?', status: 'needs_human', reason: 'no_evidence', accepted: false, wrongFact: false, guarded: true },
  ],
  ...overrides,
});

describe('compareResults', () => {
  it('puts both providers side by side', () => {
    const md = compareResults(result('mock'), result('live-model'));
    expect(md).toContain('| Metric | mock | live-model |');
    expect(md).toContain('| Drafted without a person | 2 | 2 |');
    expect(md).toContain('| Wrong facts | 0 | 0 |');
  });

  it('says so when nothing differs', () => {
    expect(compareResults(result('mock'), result('live'))).toContain('No question was handled differently.');
  });

  it('lists every question handled differently', () => {
    const live = result('live', {
      items: [
        { key: 'a:1', question: 'Q1?', status: 'draftable', accepted: false, wrongFact: true, guarded: false },
        { key: 'a:2', question: 'Q2?', status: 'draftable', accepted: false, wrongFact: false, guarded: true },
      ],
    });
    const md = compareResults(result('mock'), live);
    expect(md).toContain('a:1');
    expect(md).toContain('WRONG FACT');
    expect(md).toContain('a:2');
    expect(md).toContain('needs a person (no_evidence)');
  });
});
