import { describe, it, expect } from 'vitest';
import { ExportRefusedError, selectExportRows, type ReviewItem } from './approval';

const accepted: ReviewItem = {
  draftId: 'd1',
  answerText: 'We encrypt data at rest.',
  review: { id: 'r1', draftId: 'd1', decision: 'accept' },
};

describe('selectExportRows', () => {
  it('exports accepted drafts with the draft text and review id', () => {
    expect(selectExportRows([accepted])).toEqual([
      { draftId: 'd1', reviewId: 'r1', text: 'We encrypt data at rest.' },
    ]);
  });

  it('exports the reviewer text for edited drafts', () => {
    const edited: ReviewItem = {
      draftId: 'd2',
      answerText: 'Draft text.',
      review: { id: 'r2', draftId: 'd2', decision: 'edit', finalText: 'Reviewer text.' },
    };
    expect(selectExportRows([edited])).toEqual([{ draftId: 'd2', reviewId: 'r2', text: 'Reviewer text.' }]);
  });

  it('leaves rejected drafts out of the export', () => {
    const rejected: ReviewItem = {
      draftId: 'd3',
      answerText: 'Bad draft.',
      review: { id: 'r3', draftId: 'd3', decision: 'reject' },
    };
    expect(selectExportRows([accepted, rejected])).toHaveLength(1);
  });

  it('refuses the whole export when any draft is unreviewed', () => {
    const unreviewed: ReviewItem = { draftId: 'd4', answerText: 'Pending.' };
    expect(() => selectExportRows([accepted, unreviewed])).toThrow(ExportRefusedError);
  });

  it('refuses an edit decision with no final text', () => {
    const bad: ReviewItem = {
      draftId: 'd5',
      answerText: 'Draft.',
      review: { id: 'r5', draftId: 'd5', decision: 'edit' },
    };
    expect(() => selectExportRows([bad])).toThrow(ExportRefusedError);
  });

  it('refuses an accept decision on a needs_human draft that has no text', () => {
    const bad: ReviewItem = {
      draftId: 'd6',
      answerText: null,
      review: { id: 'r6', draftId: 'd6', decision: 'accept' },
    };
    expect(() => selectExportRows([bad])).toThrow(ExportRefusedError);
  });

  it('exports a needs_human draft through an edit decision with reviewer text', () => {
    const human: ReviewItem = {
      draftId: 'd7',
      answerText: null,
      review: { id: 'r7', draftId: 'd7', decision: 'edit', finalText: 'Written by a person.' },
    };
    expect(selectExportRows([human])).toEqual([{ draftId: 'd7', reviewId: 'r7', text: 'Written by a person.' }]);
  });

  it('refuses a review that belongs to a different draft', () => {
    const mismatched: ReviewItem = {
      draftId: 'd8',
      answerText: 'Text.',
      review: { id: 'r8', draftId: 'other', decision: 'accept' },
    };
    expect(() => selectExportRows([mismatched])).toThrow(ExportRefusedError);
  });
});
