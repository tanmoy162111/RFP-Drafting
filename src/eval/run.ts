import type { Db } from '../db/client';
import { draftDocument, type DraftedQuestion } from '../drafting/run';
import type { DraftProvider } from '../drafting/types';
import { DEFAULT_CONFIG, type DomainConfig } from '../domain/config';
import { computeMetrics, hasWrongFact, isAccepted, type DraftOutcome, type Metrics } from '../domain/scoring';
import { ANSWER_KEY, HELD_OUT_DOCUMENTS } from '../fixtures/held-out';
import { verifyPersistedDrafts } from './verify';

export interface Gate {
  name: string;
  pass: boolean;
  actual: number;
  required: string;
}

export interface EvalItem {
  key: string;
  question: string;
  status: 'draftable' | 'needs_human';
  reason?: string;
  accepted: boolean;
  wrongFact: boolean;
  /** True for traps and unanswerable questions, which must go to a person. */
  guarded: boolean;
}

export interface EvalResult {
  provider: string;
  now: string;
  metrics: Metrics;
  gates: Gate[];
  humanByReason: Record<string, number>;
  items: EvalItem[];
}

/** Drafts both held-out documents, persists the drafts, and scores them against the answer key. */
export async function runEval(
  db: Db,
  provider: DraftProvider,
  now: Date,
  config: DomainConfig = DEFAULT_CONFIG,
): Promise<EvalResult> {
  const drafted: DraftedQuestion[] = [];
  for (const doc of HELD_OUT_DOCUMENTS) drafted.push(...(await draftDocument(db, provider, doc.slug, now)));

  const grounded = await verifyPersistedDrafts(
    db,
    drafted.filter((d) => d.decision.status === 'draftable').map((d) => d.draftId),
  );

  const outcomes: DraftOutcome[] = drafted.map((d) =>
    d.decision.status === 'draftable'
      ? {
          questionId: d.key,
          status: 'draftable',
          answer: d.decision.answer,
          yesNo: d.decision.yesNo,
          provenanceOk: grounded.get(d.draftId) === true,
        }
      : { questionId: d.key, status: 'needs_human', provenanceOk: true },
  );

  const metrics = computeMetrics(outcomes, ANSWER_KEY, config);
  const questionText = new Map(drafted.map((d) => [d.key, d.text]));
  const reasonByKey = new Map(drafted.map((d) => [d.key, d.decision.status === 'needs_human' ? d.decision.reason : undefined]));

  const items: EvalItem[] = ANSWER_KEY.map((key) => {
    const outcome = outcomes.find((o) => o.questionId === key.questionId)!;
    return {
      key: key.questionId,
      question: questionText.get(key.questionId) ?? '',
      status: outcome.status,
      reason: reasonByKey.get(key.questionId),
      accepted: isAccepted(outcome, key, config.similarityThreshold),
      wrongFact: hasWrongFact(outcome, key),
      guarded: key.trap || !key.supported,
    };
  });

  const humanByReason: Record<string, number> = {};
  for (const item of items) {
    if (item.status === 'needs_human') humanByReason[item.reason ?? 'unknown'] = (humanByReason[item.reason ?? 'unknown'] ?? 0) + 1;
  }

  const gates: Gate[] = [
    { name: 'Citation coverage', pass: metrics.citationCoverage === 1, actual: metrics.citationCoverage, required: '= 100%' },
    { name: 'Correct routing of traps and unanswerable questions', pass: metrics.correctRouting === 1, actual: metrics.correctRouting, required: '= 100%' },
    { name: 'Wrong facts', pass: metrics.wrongFactCount === 0, actual: metrics.wrongFactCount, required: '= 0' },
  ];

  return { provider: provider.name, now: now.toISOString().slice(0, 10), metrics, gates, humanByReason, items };
}

export const allGatesPass = (result: EvalResult): boolean => result.gates.every((gate) => gate.pass);
