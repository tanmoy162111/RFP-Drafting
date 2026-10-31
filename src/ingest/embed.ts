import { EMBEDDING_DIMS } from '../shared/constants';
import { contentWords, stem } from './text';

/** 32-bit FNV-1a hash. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Deterministic hashed bag-of-words embedding (mock; no network, no API key).
 * Unigrams weigh 1, adjacent-pair bigrams weigh 0.5. The result is L2-normalised.
 * Empty input returns the first basis vector, because pgvector cosine distance is undefined for a zero vector.
 */
export function embed(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMS).fill(0);
  const tokens = contentWords(text).map(stem);

  const add = (key: string, weight: number): void => {
    const hash = fnv1a(key);
    const sign = (hash >>> 16) & 1 ? 1 : -1;
    vector[hash % EMBEDDING_DIMS]! += sign * weight;
  };

  for (const token of tokens) add(token, 1);
  for (let i = 0; i < tokens.length - 1; i++) add(`${tokens[i]}_${tokens[i + 1]}`, 0.5);

  const length = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  if (length === 0) {
    vector[0] = 1;
    return vector;
  }
  return vector.map((x) => x / length);
}
