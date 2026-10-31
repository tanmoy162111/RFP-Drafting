import type { SheetRow } from './csv';
import type { QuestionView } from './types';

/** One row per question, in order. Only accepted and edited answers carry text; the export gate lives in export.ts. */
export function buildSheetRows(questions: QuestionView[]): SheetRow[] {
  return questions.map((q) => {
    const row = { ordinal: q.ordinal, section: q.section, question: q.text };
    const { review, draft } = q;
    if (!review || !draft) return { ...row, answer: '', status: 'not reviewed', sources: '' };
    if (review.decision === 'reject') {
      return { ...row, answer: '', status: 'rejected - left for a person', sources: '' };
    }

    const sources = [...new Set(q.citations.map((c) => c.sourceTitle))].join('; ');
    if (review.decision === 'accept') {
      return { ...row, answer: draft.answerText ?? '', status: 'accepted', sources };
    }
    return draft.status === 'draftable'
      ? { ...row, answer: review.finalText ?? '', status: 'edited by reviewer', sources }
      : { ...row, answer: review.finalText ?? '', status: 'written by reviewer', sources: '' };
  });
}
