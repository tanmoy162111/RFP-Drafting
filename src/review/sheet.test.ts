import { describe, it, expect } from 'vitest';
import { buildSheetRows } from './sheet';
import type { QuestionView } from './types';

const base = (ordinal: number, overrides: Partial<QuestionView> = {}): QuestionView => ({
  questionId: `q${ordinal}`,
  ordinal,
  section: 'S',
  text: `Question ${ordinal}?`,
  parseStatus: 'parsed',
  draft: { id: `d${ordinal}`, status: 'draftable', reasonCode: null, answerText: 'Drafted answer.', model: 'mock' },
  citations: [
    { entryId: 'e1', sourceTitle: 'Policy (mock)', sourceStatus: 'approved', topic: 'T', reviewedAt: '2026-01-01', quote: null },
    { entryId: 'e2', sourceTitle: 'Policy (mock)', sourceStatus: 'approved', topic: 'U', reviewedAt: '2026-01-01', quote: null },
  ],
  review: null,
  ...overrides,
});

const review = (decision: 'accept' | 'edit' | 'reject', finalText: string | null = null) => ({
  id: 'r',
  decision,
  finalText,
  editDistance: 0,
  exported: true,
});

describe('buildSheetRows', () => {
  it('uses the drafted text for accepted answers and lists each source title once', () => {
    const [row] = buildSheetRows([base(1, { review: review('accept') })]);
    expect(row).toEqual({
      ordinal: 1,
      section: 'S',
      question: 'Question 1?',
      answer: 'Drafted answer.',
      status: 'accepted',
      sources: 'Policy (mock)',
    });
  });

  it('uses the reviewer text for edited answers', () => {
    const [row] = buildSheetRows([base(1, { review: review('edit', 'Reviewed answer.') })]);
    expect(row).toMatchObject({ answer: 'Reviewed answer.', status: 'edited by reviewer', sources: 'Policy (mock)' });
  });

  it('marks a person-written answer and gives it no sources', () => {
    const q = base(2, {
      draft: { id: 'd2', status: 'needs_human', reasonCode: 'conflict', answerText: null, model: 'mock' },
      citations: [],
      review: review('edit', 'Written by a person.'),
    });
    expect(buildSheetRows([q])[0]).toMatchObject({ answer: 'Written by a person.', status: 'written by reviewer', sources: '' });
  });

  it('leaves rejected answers blank and says why', () => {
    expect(buildSheetRows([base(3, { review: review('reject') })])[0]).toMatchObject({
      answer: '',
      status: 'rejected - left for a person',
      sources: '',
    });
  });

  it('marks unreviewed questions', () => {
    expect(buildSheetRows([base(4)])[0]).toMatchObject({ answer: '', status: 'not reviewed' });
  });
});
