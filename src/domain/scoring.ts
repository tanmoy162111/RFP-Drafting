import { DEFAULT_CONFIG, type DomainConfig } from './config';
import { extractFigures } from './figures';

export interface KeyItem {
  questionId: string;
  /** What the team actually submitted. Empty when the library cannot support an answer. */
  submittedAnswer: string;
  /** False when the library genuinely cannot answer this question. */
  supported: boolean;
  /** True for seeded traps (conflicts, deprecated sources, injections). */
  trap: boolean;
  yesNo?: 'yes' | 'no';
  keyFacts: string[];
}

export interface DraftOutcome {
  questionId: string;
  status: 'draftable' | 'needs_human';
  answer?: string;
  yesNo?: 'yes' | 'no';
  provenanceOk: boolean;
}

export interface Metrics {
  drafted: number;
  acceptedRate: number;
  citationCoverage: number;
  correctRouting: number;
  wrongFactCount: number;
  hoursSavedEstimate: number;
}

const normalize = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** 1 minus the normalized edit distance, on lowercased whitespace-collapsed text. */
export function similarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  const max = Math.max(x.length, y.length);
  if (max === 0) return 1;
  return 1 - levenshtein(x, y) / max;
}

/** Character edit distance between two texts, ignoring case and spacing differences. */
export function editDistance(a: string, b: string): number {
  return levenshtein(normalize(a), normalize(b));
}

export function isAccepted(outcome: DraftOutcome, key: KeyItem, threshold: number): boolean {
  if (outcome.status !== 'draftable' || outcome.answer === undefined) return false;
  if (similarity(outcome.answer, key.submittedAnswer) < threshold) return false;
  const answer = normalize(outcome.answer);
  if (!key.keyFacts.every((fact) => answer.includes(normalize(fact)))) return false;
  if (key.yesNo !== undefined && outcome.yesNo !== key.yesNo) return false;
  return true;
}

/** A draftable answer contradicts the key: opposite yes/no, or a figure the key does not contain. */
export function hasWrongFact(outcome: DraftOutcome, key: KeyItem): boolean {
  if (outcome.status !== 'draftable' || outcome.answer === undefined) return false;
  if (key.yesNo !== undefined && outcome.yesNo !== undefined && outcome.yesNo !== key.yesNo) return true;
  const allowed = extractFigures(`${key.submittedAnswer} ${key.keyFacts.join(' ')}`);
  for (const fig of extractFigures(outcome.answer)) {
    if (!allowed.has(fig)) return true;
  }
  return false;
}

export function computeMetrics(
  outcomes: DraftOutcome[],
  key: KeyItem[],
  config: DomainConfig = DEFAULT_CONFIG,
): Metrics {
  const byId = new Map(outcomes.map((o) => [o.questionId, o]));
  const pairs = key.map((k) => {
    const o = byId.get(k.questionId);
    if (!o) throw new Error(`missing outcome for ${k.questionId}`);
    return { k, o };
  });

  const drafted = pairs.filter((p) => p.o.status === 'draftable');
  const guarded = pairs.filter((p) => p.k.trap || !p.k.supported);

  const accepted = drafted.filter((p) => isAccepted(p.o, p.k, config.similarityThreshold)).length;
  const grounded = drafted.filter((p) => p.o.provenanceOk).length;
  const routed = guarded.filter((p) => p.o.status === 'needs_human').length;

  return {
    drafted: drafted.length,
    acceptedRate: drafted.length === 0 ? 0 : accepted / drafted.length,
    citationCoverage: drafted.length === 0 ? 1 : grounded / drafted.length,
    correctRouting: guarded.length === 0 ? 1 : routed / guarded.length,
    wrongFactCount: drafted.filter((p) => hasWrongFact(p.o, p.k)).length,
    hoursSavedEstimate: Math.round(((drafted.length * config.minutesPerManualAnswer) / 60) * 100) / 100,
  };
}
