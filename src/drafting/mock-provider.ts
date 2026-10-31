import { contentWords, stem } from '../ingest/text';
import type { DraftProvider, DraftRequest, DraftResponse } from './types';

const sentencesOf = (text: string): string[] => text.split(/(?<=[.!?])\s+/).filter((s) => s.trim() !== '');

/**
 * Deterministic extractive drafter (mock). It quotes the best-matching sentence of the best evidence entry,
 * so every answer is grounded by construction. It never answers "no"; polarity is only tested with the live provider.
 */
export class MockDraftProvider implements DraftProvider {
  readonly name = 'mock-extractive';

  async draft(request: DraftRequest): Promise<DraftResponse> {
    const top = request.evidence[0];
    if (!top) throw new Error('mock provider needs at least one evidence entry');

    const wanted = new Set(contentWords(request.question).map(stem));
    let best = '';
    let bestScore = -1;
    for (const sentence of sentencesOf(top.text)) {
      const present = new Set(contentWords(sentence).map(stem));
      const score = [...wanted].filter((word) => present.has(word)).length;
      if (score > bestScore) {
        best = sentence;
        bestScore = score;
      }
    }

    const isYesNo = request.answerType === 'yes_no';
    return {
      answer: isYesNo ? `Yes. ${best}` : best,
      claims: [{ text: best, entryIds: [top.entryId] }],
      ...(isYesNo ? { yesNo: 'yes' as const } : {}),
    };
  }
}
