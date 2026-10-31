import type { DraftClaim } from '../domain/provenance';
import type { AnswerType, Evidence } from '../domain/types';

export interface DraftRequest {
  question: string;
  answerType: AnswerType;
  /** Already screened and routed: approved, fresh, relevant, best first. */
  evidence: Evidence[];
}

export interface DraftResponse {
  answer: string;
  claims: DraftClaim[];
  yesNo?: 'yes' | 'no';
}

/** A source of draft answers. The pipeline validates everything a provider returns. */
export interface DraftProvider {
  readonly name: string;
  draft(request: DraftRequest): Promise<DraftResponse>;
}
