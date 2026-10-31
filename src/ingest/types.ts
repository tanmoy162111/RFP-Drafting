import type { SourceStatus } from '../domain/types';
import type { DOCUMENT_KINDS, SOURCE_KINDS } from '../shared/constants';

export type SourceKind = (typeof SOURCE_KINDS)[number];
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** One library source. `body` is chunked into entries (see chunkBody). */
export interface SourceInput {
  slug: string;
  title: string;
  kind: SourceKind;
  owner: string;
  /** ISO date, YYYY-MM-DD. */
  lastReviewedAt: string;
  status: SourceStatus;
  body: string;
}

/** One incoming RFP or questionnaire. `text` is parsed by parseDocument. */
export interface DocumentInput {
  slug: string;
  kind: DocumentKind;
  title: string;
  heldOut: boolean;
  text: string;
}
