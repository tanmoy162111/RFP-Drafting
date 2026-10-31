import type { Decision } from '../domain/approval';
import type { ReasonCode, SourceStatus } from '../domain/types';

export interface CitationView {
  entryId: string;
  sourceTitle: string;
  sourceStatus: SourceStatus;
  topic: string;
  /** ISO date the source was last reviewed. */
  reviewedAt: string;
  quote: string | null;
}

export interface DraftView {
  id: string;
  status: 'draftable' | 'needs_human';
  reasonCode: ReasonCode | null;
  answerText: string | null;
  model: string;
}

export interface ReviewView {
  id: string;
  decision: Decision;
  finalText: string | null;
  editDistance: number;
  /** True once an export row exists for this review. */
  exported: boolean;
}

export interface QuestionView {
  questionId: string;
  ordinal: number;
  section: string;
  /** For unparsed rows this is the raw line. */
  text: string;
  parseStatus: 'parsed' | 'unparsed';
  draft: DraftView | null;
  citations: CitationView[];
  review: ReviewView | null;
}

export interface DocumentView {
  id: string;
  slug: string;
  title: string;
  kind: 'rfp' | 'questionnaire';
  questions: QuestionView[];
}
