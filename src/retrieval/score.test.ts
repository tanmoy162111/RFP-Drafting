import { describe, it, expect } from 'vitest';
import { fuse, lexicalScore } from './score';

describe('lexicalScore', () => {
  it('is 1 when every question word is in the entry', () => {
    expect(lexicalScore('Do you encrypt data?', 'We encrypt all data')).toBe(1);
  });

  it('is 0 when nothing overlaps', () => {
    expect(lexicalScore('Do you encrypt data?', 'Pricing starts at 40000 USD')).toBe(0);
  });

  it('is the fraction of question words found, ignoring plurals', () => {
    expect(lexicalScore('Do you encrypt customer data?', 'We encrypts data at rest')).toBeCloseTo(2 / 3);
  });

  it('is 0 for a question with no content words', () => {
    expect(lexicalScore('Do you?', 'anything')).toBe(0);
  });
});

describe('fuse', () => {
  it('averages vector and lexical scores', () => {
    expect(fuse(0.4, 0.8)).toBeCloseTo(0.6);
  });

  it('clamps to the 0 to 1 range', () => {
    expect(fuse(-0.5, -0.5)).toBe(0);
    expect(fuse(2, 2)).toBe(1);
  });
});
