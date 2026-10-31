import { extractFigures } from './figures';
import type { Evidence } from './types';

export interface DraftClaim {
  text: string;
  entryIds: string[];
}

export interface ProvenanceInput {
  answer: string;
  claims: DraftClaim[];
}

export type ProvenanceResult = { ok: true } | { ok: false; violations: string[] };

/**
 * Deterministic grounding check. `evidence` must be the list returned by routeQuestion.
 * Violation codes carry entry IDs and figure tokens only, never document text.
 */
export function checkProvenance(input: ProvenanceInput, evidence: Evidence[]): ProvenanceResult {
  const violations: string[] = [];
  const byId = new Map(evidence.map((e) => [e.entryId, e]));

  if (input.answer.trim() === '') violations.push('empty_answer');
  if (input.claims.length === 0) violations.push('no_claims');

  const cited = new Map<string, Evidence>();
  for (const claim of input.claims) {
    if (claim.entryIds.length === 0) violations.push('claim_without_citation');
    for (const id of claim.entryIds) {
      const entry = byId.get(id);
      if (!entry) {
        violations.push(`unknown_citation:${id}`);
        continue;
      }
      if (entry.sourceStatus === 'deprecated') violations.push(`deprecated_citation:${id}`);
      cited.set(id, entry);
    }
  }

  const supported = new Set<string>();
  for (const entry of cited.values()) {
    for (const fig of extractFigures(entry.text)) supported.add(fig);
    for (const fact of entry.facts) {
      for (const fig of extractFigures(fact.value)) supported.add(fig);
    }
  }
  for (const fig of extractFigures(input.answer)) {
    if (!supported.has(fig)) violations.push(`unsupported_figure:${fig}`);
  }

  return violations.length === 0 ? { ok: true } : { ok: false, violations: [...new Set(violations)] };
}
