export type SourceStatus = 'approved' | 'draft' | 'deprecated';
export type AnswerType = 'yes_no' | 'narrative' | 'choice';
export type ReasonCode = 'conflict' | 'stale' | 'no_evidence' | 'low_confidence';

/** A structured fact extracted from a library entry at ingest, e.g. soc2_report_date = 2025-03-31. */
export interface Fact {
  key: string;
  value: string;
}

/** One retrieved library entry offered as evidence for a question. */
export interface Evidence {
  entryId: string;
  sourceId: string;
  sourceStatus: SourceStatus;
  /** ISO date, YYYY-MM-DD. */
  lastReviewedAt: string;
  text: string;
  /** Retrieval relevance, 0 to 1. */
  score: number;
  facts: Fact[];
}
