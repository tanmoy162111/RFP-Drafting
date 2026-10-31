import { contentWords, stem } from '../ingest/text';

const W_VECTOR = 0.5;
const W_LEXICAL = 0.5;

/** Share of the question's content words (plural-stripped) that appear in the entry text. */
export function lexicalScore(question: string, entryText: string): number {
  const wanted = [...new Set(contentWords(question).map(stem))];
  if (wanted.length === 0) return 0;
  const present = new Set(contentWords(entryText).map(stem));
  return wanted.filter((w) => present.has(w)).length / wanted.length;
}

/** Equal-weight blend of vector similarity and keyword overlap, clamped to 0..1. */
export function fuse(vectorSimilarity: number, lexical: number): number {
  return Math.min(1, Math.max(0, W_VECTOR * vectorSimilarity + W_LEXICAL * lexical));
}
