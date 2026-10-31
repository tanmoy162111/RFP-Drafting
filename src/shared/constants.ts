/** Size of the deterministic local embedding (mock). A real embedding provider is decided in Plan 3. */
export const EMBEDDING_DIMS = 256;

export const SOURCE_KINDS = ['past_proposal', 'policy', 'approved_answer', 'certification'] as const;
export const SOURCE_STATUSES = ['approved', 'draft', 'deprecated'] as const;
export const DOCUMENT_KINDS = ['rfp', 'questionnaire'] as const;
export const ANSWER_TYPES = ['yes_no', 'narrative', 'choice'] as const;
export const PARSE_STATUSES = ['parsed', 'unparsed'] as const;
export const DRAFT_STATUSES = ['draftable', 'needs_human'] as const;
export const REASON_CODES = ['conflict', 'stale', 'no_evidence', 'low_confidence'] as const;
export const REVIEW_DECISIONS = ['accept', 'edit', 'reject'] as const;
export const FINDING_KINDS = ['stale', 'conflict', 'duplicate', 'gap', 'injection'] as const;
