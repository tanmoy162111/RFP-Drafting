import { DEFAULT_CONFIG, type DomainConfig } from '../domain/config';
import { similarity } from '../domain/scoring';
import type { QuestionView } from './types';

export interface ReviewSummary {
  questions: number;
  draftable: number;
  needsHuman: number;
  reviewed: number;
  pending: number;
  accepted: number;
  editedMinor: number;
  editedMajor: number;
  writtenByPerson: number;
  rejected: number;
  /** Share of judged drafts accepted as drafted or edited slightly. Null until a draft has been judged. */
  acceptedWithoutMajorEdits: number | null;
  /** An assumption (minutes per manual answer times answers kept), not a measurement. */
  minutesSavedEstimate: number;
}

/** An edit is minor when the reviewed text is still close to the draft (same threshold as the eval). */
export function isMinorEdit(draftText: string, finalText: string, config: DomainConfig = DEFAULT_CONFIG): boolean {
  return similarity(draftText, finalText) >= config.similarityThreshold;
}

export function summarize(questions: QuestionView[], config: DomainConfig = DEFAULT_CONFIG): ReviewSummary {
  const counts = {
    questions: questions.length,
    draftable: 0,
    needsHuman: 0,
    reviewed: 0,
    pending: 0,
    accepted: 0,
    editedMinor: 0,
    editedMajor: 0,
    writtenByPerson: 0,
    rejected: 0,
  };
  let rejectedDrafts = 0;

  for (const q of questions) {
    if (q.draft?.status === 'draftable') counts.draftable += 1;
    if (q.draft?.status === 'needs_human') counts.needsHuman += 1;
    if (!q.draft || !q.review) {
      counts.pending += 1;
      continue;
    }
    counts.reviewed += 1;
    const { decision, finalText } = q.review;
    if (decision === 'accept') {
      counts.accepted += 1;
    } else if (decision === 'reject') {
      counts.rejected += 1;
      if (q.draft.status === 'draftable') rejectedDrafts += 1;
    } else if (q.draft.status === 'needs_human') {
      counts.writtenByPerson += 1;
    } else if (isMinorEdit(q.draft.answerText ?? '', finalText ?? '', config)) {
      counts.editedMinor += 1;
    } else {
      counts.editedMajor += 1;
    }
  }

  const kept = counts.accepted + counts.editedMinor;
  const judged = kept + counts.editedMajor + rejectedDrafts;
  return {
    ...counts,
    acceptedWithoutMajorEdits: judged === 0 ? null : kept / judged,
    minutesSavedEstimate: kept * config.minutesPerManualAnswer,
  };
}

export type ExportState = 'pending-review' | 'ready' | 'exported';

/** pending-review: something still needs a decision. ready: all decided, export not recorded. exported: recorded. */
export function exportState(questions: QuestionView[]): ExportState {
  if (questions.some((q) => !q.draft || !q.review)) return 'pending-review';
  const exportable = questions.filter((q) => q.review!.decision !== 'reject');
  return exportable.length > 0 && exportable.every((q) => q.review!.exported) ? 'exported' : 'ready';
}
