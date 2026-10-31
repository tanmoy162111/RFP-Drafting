import { describe, it, expect } from 'vitest';
import { computeMetrics, editDistance, hasWrongFact, isAccepted, similarity, type DraftOutcome, type KeyItem } from './scoring';

const key: KeyItem[] = [
  {
    questionId: 'q1',
    submittedAnswer: 'Yes. We encrypt data at rest with AES-256.',
    supported: true,
    trap: false,
    yesNo: 'yes',
    keyFacts: ['AES-256'],
  },
  {
    questionId: 'q2',
    submittedAnswer: 'Our SOC 2 Type II report is dated 2025-03-31.',
    supported: true,
    trap: false,
    keyFacts: ['2025-03-31'],
  },
  { questionId: 'q3', submittedAnswer: '', supported: false, trap: true, keyFacts: [] },
  { questionId: 'q4', submittedAnswer: '', supported: false, trap: false, keyFacts: [] },
];

const outcomes: DraftOutcome[] = [
  {
    questionId: 'q1',
    status: 'draftable',
    answer: 'Yes. We encrypt data at rest with AES-256.',
    yesNo: 'yes',
    provenanceOk: true,
  },
  {
    questionId: 'q2',
    status: 'draftable',
    answer: 'Our SOC 2 Type II report is dated 2024-03-31.',
    provenanceOk: false,
  },
  { questionId: 'q3', status: 'needs_human', provenanceOk: true },
  { questionId: 'q4', status: 'draftable', answer: 'We do offer a free trial.', provenanceOk: true },
];

describe('similarity', () => {
  it('is 1 for identical text ignoring case and spacing', () => {
    expect(similarity('Hello   World', 'hello world')).toBe(1);
  });

  it('is 1 for two empty strings', () => {
    expect(similarity('', '')).toBe(1);
  });

  it('is lower for different text', () => {
    expect(similarity('abc', 'xyz')).toBe(0);
  });
});

describe('isAccepted', () => {
  it('accepts a matching answer with matching yes/no and key facts', () => {
    expect(isAccepted(outcomes[0]!, key[0]!, 0.8)).toBe(true);
  });

  it('rejects an answer missing a key fact even when text is similar', () => {
    expect(isAccepted(outcomes[1]!, key[1]!, 0.8)).toBe(false);
  });

  it('rejects a yes/no mismatch', () => {
    const flipped: DraftOutcome = { ...outcomes[0]!, yesNo: 'no' };
    expect(isAccepted(flipped, key[0]!, 0.8)).toBe(false);
  });

  it('never accepts a needs_human outcome', () => {
    expect(isAccepted(outcomes[2]!, key[2]!, 0.8)).toBe(false);
  });
});

describe('hasWrongFact', () => {
  it('flags a figure that is not in the submitted answer or key facts', () => {
    expect(hasWrongFact(outcomes[1]!, key[1]!)).toBe(true);
  });

  it('flags a yes/no contradiction', () => {
    expect(hasWrongFact({ ...outcomes[0]!, yesNo: 'no' }, key[0]!)).toBe(true);
  });

  it('does not flag a faithful answer', () => {
    expect(hasWrongFact(outcomes[0]!, key[0]!)).toBe(false);
  });
});

describe('computeMetrics', () => {
  it('computes all metrics from outcomes and the key', () => {
    const m = computeMetrics(outcomes, key);
    expect(m.drafted).toBe(3);
    expect(m.acceptedRate).toBeCloseTo(1 / 3);
    expect(m.citationCoverage).toBeCloseTo(2 / 3);
    expect(m.correctRouting).toBeCloseTo(0.5);
    expect(m.wrongFactCount).toBe(1);
    expect(m.hoursSavedEstimate).toBe(1);
  });

  it('reports 0 accepted and full coverage when nothing was drafted', () => {
    const none: DraftOutcome[] = key.map((k) => ({
      questionId: k.questionId,
      status: 'needs_human',
      provenanceOk: true,
    }));
    const m = computeMetrics(none, key);
    expect(m.drafted).toBe(0);
    expect(m.acceptedRate).toBe(0);
    expect(m.citationCoverage).toBe(1);
    expect(m.correctRouting).toBe(1);
  });

  it('throws when a key question has no outcome', () => {
    expect(() => computeMetrics(outcomes.slice(1), key)).toThrow('missing outcome for q1');
  });
});

describe('editDistance', () => {
  it('is 0 for text that differs only in case and spacing', () => {
    expect(editDistance('Hello   World', 'hello world')).toBe(0);
  });

  it('counts single-character changes', () => {
    expect(editDistance('abc', 'abd')).toBe(1);
    expect(editDistance('retains data for 90 days', 'retains data for 60 days')).toBe(1);
  });

  it('is the length of the other text when one side is empty', () => {
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
  });
});
