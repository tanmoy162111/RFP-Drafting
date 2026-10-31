import { describe, it, expect } from 'vitest';
import type { EvalResult } from './run';
import { renderEvalReport } from './report';

const result: EvalResult = {
  provider: 'mock-extractive',
  now: '2026-10-31',
  metrics: {
    drafted: 55,
    acceptedRate: 0.9,
    citationCoverage: 1,
    correctRouting: 1,
    wrongFactCount: 0,
    hoursSavedEstimate: 18.33,
  },
  gates: [
    { name: 'Citation coverage', pass: true, actual: 1, required: '= 100%' },
    { name: 'Wrong facts', pass: false, actual: 2, required: '= 0' },
  ],
  humanByReason: { conflict: 1, no_evidence: 8, stale: 1 },
  items: [
    { key: 'fabrikam-rfp:1', question: 'Describe encryption.', status: 'draftable', accepted: false, wrongFact: false, guarded: false },
    { key: 'fabrikam-rfp:2', question: 'SOC 2 date?', status: 'needs_human', reason: 'conflict', accepted: false, wrongFact: false, guarded: true },
  ],
};

describe('renderEvalReport', () => {
  it('shows the provider, metrics and gate results', () => {
    const report = renderEvalReport(result);
    expect(report).toContain('mock-extractive');
    expect(report).toContain('90.0%');
    expect(report).toContain('| Citation coverage | PASS |');
    expect(report).toContain('| Wrong facts | FAIL |');
  });

  it('states that the hours saved figure is an assumption and the data is mock', () => {
    const report = renderEvalReport(result);
    expect(report).toContain('assumption');
    expect(report).toContain('mock');
  });

  it('lists the questions that were routed to a person and the drafts that were not accepted', () => {
    const report = renderEvalReport(result);
    expect(report).toContain('fabrikam-rfp:2');
    expect(report).toContain('conflict');
    expect(report).toContain('fabrikam-rfp:1');
  });
});
