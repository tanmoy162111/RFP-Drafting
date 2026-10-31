import { DEFAULT_CONFIG, type DomainConfig } from '../domain/config';
import { screenEvidence } from '../domain/injection';
import { checkProvenance, type DraftClaim } from '../domain/provenance';
import { routeQuestion } from '../domain/routing';
import type { AnswerType, Evidence, ReasonCode } from '../domain/types';
import { draftResponseSchema } from './schema';
import type { DraftProvider, DraftResponse } from './types';

export interface DecideInput {
  question: string;
  answerType: AnswerType;
  evidence: Evidence[];
  now: Date;
}

export type Decision =
  | {
      status: 'draftable';
      answer: string;
      yesNo?: 'yes' | 'no';
      claims: DraftClaim[];
      citedEntryIds: string[];
      model: string;
      flaggedEntryIds: string[];
    }
  | { status: 'needs_human'; reason: ReasonCode; detail: string[]; model: string; flaggedEntryIds: string[] };

const MAX_ATTEMPTS = 2;

/**
 * Decide, and if allowed draft, one answer. The model never decides routing; every failure becomes needs_human.
 * Detail strings are codes (fact keys, entry ids, violation codes), never document text.
 */
export async function decideDraft(
  provider: DraftProvider,
  input: DecideInput,
  config: DomainConfig = DEFAULT_CONFIG,
): Promise<Decision> {
  const { clean, flagged } = screenEvidence(input.evidence);
  const flaggedEntryIds = flagged.map((entry) => entry.entryId);
  const needsHuman = (reason: ReasonCode, detail: string[]): Decision => ({
    status: 'needs_human',
    reason,
    detail,
    model: provider.name,
    flaggedEntryIds,
  });

  const route = routeQuestion(clean, input.now, config);
  if (route.status === 'needs_human') {
    return needsHuman(route.reason, route.conflicts?.map((c) => c.key) ?? []);
  }

  let response: DraftResponse | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && response === undefined; attempt++) {
    try {
      const raw = await provider.draft({
        question: input.question,
        answerType: input.answerType,
        evidence: route.evidence,
      });
      const parsed = draftResponseSchema.safeParse(raw);
      if (parsed.success) response = parsed.data;
    } catch {
      // Retry once; the error text is not logged because it may echo document content.
    }
  }
  if (response === undefined) return needsHuman('low_confidence', ['provider_failed']);

  const provenance = checkProvenance({ answer: response.answer, claims: response.claims }, route.evidence);
  if (!provenance.ok) return needsHuman('low_confidence', provenance.violations);

  if (input.answerType === 'yes_no' && response.yesNo === undefined) {
    return needsHuman('low_confidence', ['missing_yes_no']);
  }

  return {
    status: 'draftable',
    answer: response.answer,
    ...(response.yesNo !== undefined ? { yesNo: response.yesNo } : {}),
    claims: response.claims,
    citedEntryIds: [...new Set(response.claims.flatMap((claim) => claim.entryIds))],
    model: provider.name,
    flaggedEntryIds,
  };
}
