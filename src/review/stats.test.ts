import { describe, it, expect } from 'vitest';
import { exportState, isMinorEdit, summarize } from './stats';
import type { QuestionView, ReviewView } from './types';

const DRAFT_TEXT = 'Northwind retains customer data for 90 days.';

function question(ordinal: number, overrides: Partial<QuestionView> = {}): QuestionView {
  return {
    questionId: `q${ordinal}`,
    ordinal,
    section: 'S',
    text: `Question ${ordinal}?`,
    parseStatus: 'parsed',
    draft: { id: `d${ordinal}`, status: 'draftable', reasonCode: null, answerText: DRAFT_TEXT, model: 'mock' },
    citations: [],
    review: null,
    ...overrides,
  };
}

const review = (overrides: Partial<ReviewView> = {}): ReviewView => ({
  id: 'r',
  decision: 'accept',
  finalText: null,
  editDistance: 0,
  exported: false,
  ...overrides,
});

const needsPerson = (ordinal: number, r: ReviewView | null = null): QuestionView =>
  question(ordinal, {
    draft: { id: `d${ordinal}`, status: 'needs_human', reasonCode: 'conflict', answerText: null, model: 'mock' },
    review: r,
  });

describe('isMinorEdit', () => {
  it('treats a one-character change as minor and a rewrite as major', () => {
    expect(isMinorEdit(DRAFT_TEXT, 'Northwind retains customer data for 60 days.')).toBe(true);
    expect(isMinorEdit(DRAFT_TEXT, 'We keep data for as long as the customer asks.')).toBe(false);
  });
});

describe('summarize', () => {
  it('counts drafted, needs-person, reviewed and pending questions', () => {
    const s = summarize([question(1), question(2, { review: review() }), needsPerson(3)]);
    expect(s).toMatchObject({ questions: 3, draftable: 2, needsHuman: 1, reviewed: 1, pending: 2 });
  });

  it('classifies decisions', () => {
    const s = summarize([
      question(1, { review: review({ decision: 'accept' }) }),
      question(2, { review: review({ decision: 'edit', finalText: 'Northwind retains customer data for 60 days.' }) }),
      question(3, { review: review({ decision: 'edit', finalText: 'Something else entirely, rewritten by hand.' }) }),
      question(4, { review: review({ decision: 'reject' }) }),
      needsPerson(5, review({ decision: 'edit', finalText: 'Written by a person.' })),
      needsPerson(6, review({ decision: 'reject' })),
    ]);
    expect(s).toMatchObject({ accepted: 1, editedMinor: 1, editedMajor: 1, writtenByPerson: 1, rejected: 2 });
  });

  it('measures accepted without major edits over drafts that were judged', () => {
    const s = summarize([
      question(1, { review: review({ decision: 'accept' }) }),
      question(2, { review: review({ decision: 'edit', finalText: 'Northwind retains customer data for 60 days.' }) }),
      question(3, { review: review({ decision: 'edit', finalText: 'Something else entirely, rewritten by hand.' }) }),
      question(4, { review: review({ decision: 'reject' }) }),
    ]);
    expect(s.acceptedWithoutMajorEdits).toBeCloseTo(0.5);
    expect(s.minutesSavedEstimate).toBe(40);
  });

  it('reports null until something has been judged', () => {
    expect(summarize([question(1)]).acceptedWithoutMajorEdits).toBeNull();
  });
});

describe('exportState', () => {
  it('is pending-review while any question lacks a draft or a review', () => {
    expect(exportState([question(1, { review: review() }), question(2)])).toBe('pending-review');
    expect(exportState([question(1, { draft: null })])).toBe('pending-review');
  });

  it('is ready once every question is reviewed but not yet exported', () => {
    expect(exportState([question(1, { review: review() }), needsPerson(2, review({ decision: 'reject' }))])).toBe('ready');
  });

  it('is exported once every non-rejected review has an export record', () => {
    const done = [question(1, { review: review({ exported: true }) }), needsPerson(2, review({ decision: 'reject' }))];
    expect(exportState(done)).toBe('exported');
  });

  it('stays ready when everything was rejected, because nothing can be exported', () => {
    expect(exportState([question(1, { review: review({ decision: 'reject' }) })])).toBe('ready');
  });
});
