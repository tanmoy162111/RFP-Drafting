import type { Evidence } from './types';

const PATTERNS: RegExp[] = [
  /ignore (all |any )?(previous|prior|above) instructions/i,
  /disregard (all |any |the )?(previous|prior|above)/i,
  /you (must|should) (now )?(state|say|claim|respond|answer)/i,
  /system prompt\b/i,
  /pretend (to be|that)/i,
];

/** True when text reads like an instruction aimed at a model rather than a statement of fact. */
export function detectInjection(text: string): boolean {
  return PATTERNS.some((pattern) => pattern.test(text));
}

export interface ScreenedEvidence {
  clean: Evidence[];
  flagged: Evidence[];
}

/** Library text is untrusted data. Flagged entries are dropped before routing and never sent to a model. */
export function screenEvidence(evidence: Evidence[]): ScreenedEvidence {
  const clean: Evidence[] = [];
  const flagged: Evidence[] = [];
  for (const entry of evidence) (detectInjection(entry.text) ? flagged : clean).push(entry);
  return { clean, flagged };
}
