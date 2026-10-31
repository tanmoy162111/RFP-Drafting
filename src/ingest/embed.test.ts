import { describe, it, expect } from 'vitest';
import { EMBEDDING_DIMS } from '../shared/constants';
import { embed } from './embed';

const norm = (v: number[]): number => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
const cosine = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + x * b[i]!, 0);

describe('embed', () => {
  it('returns a vector of the configured size', () => {
    expect(embed('We encrypt data at rest')).toHaveLength(EMBEDDING_DIMS);
  });

  it('returns a unit vector', () => {
    expect(norm(embed('We encrypt data at rest'))).toBeCloseTo(1, 9);
  });

  it('is deterministic', () => {
    expect(embed('SOC 2 report')).toEqual(embed('SOC 2 report'));
  });

  it('places related text closer than unrelated text', () => {
    const q = embed('Do you encrypt customer data at rest?');
    const related = embed('We encrypt data at rest');
    const unrelated = embed('Pricing starts at 40000 USD per year');
    expect(cosine(q, related)).toBeGreaterThan(cosine(q, unrelated) + 0.2);
  });

  it('returns a unit vector even when there is nothing to embed', () => {
    expect(norm(embed(''))).toBeCloseTo(1, 9);
    expect(norm(embed('the and of'))).toBeCloseTo(1, 9);
  });
});
