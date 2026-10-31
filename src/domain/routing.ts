import { DEFAULT_CONFIG, type DomainConfig } from './config';
import { findConflicts, type Conflict } from './conflict';
import { isStale } from './staleness';
import type { Evidence, ReasonCode } from './types';

export type Routing =
  | { status: 'draftable'; evidence: Evidence[] }
  | { status: 'needs_human'; reason: ReasonCode; conflicts?: Conflict[] };

/** Decide, without any LLM, whether a question can be drafted from this evidence. */
export function routeQuestion(
  evidence: Evidence[],
  now: Date,
  config: DomainConfig = DEFAULT_CONFIG,
): Routing {
  const aboveFloor = evidence.filter((e) => e.score >= config.scoreFloor);
  const approved = aboveFloor.filter((e) => e.sourceStatus === 'approved');

  if (approved.length === 0) {
    const sawDeprecated = aboveFloor.some((e) => e.sourceStatus === 'deprecated');
    return { status: 'needs_human', reason: sawDeprecated ? 'stale' : 'no_evidence' };
  }

  const conflicts = findConflicts(approved);
  if (conflicts.length > 0) {
    return { status: 'needs_human', reason: 'conflict', conflicts };
  }

  const fresh = approved.filter((e) => !isStale(e.lastReviewedAt, now, config.stalenessMonths));
  if (fresh.length === 0) {
    return { status: 'needs_human', reason: 'stale' };
  }

  return { status: 'draftable', evidence: [...fresh].sort((a, b) => b.score - a.score) };
}
