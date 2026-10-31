import { describe, it, expect } from 'vitest';
import { draftResponseSchema, modelOutputSchema, toDraftResponse } from './schema';

const claims = [{ text: 'AES-256', entryIds: ['e1'] }];

describe('modelOutputSchema', () => {
  it('accepts the three yes/no values', () => {
    for (const yesNo of ['yes', 'no', 'not_applicable']) {
      expect(modelOutputSchema.safeParse({ answer: 'A', claims, yesNo }).success).toBe(true);
    }
  });

  it('rejects a missing field and a wrong type', () => {
    expect(modelOutputSchema.safeParse({ answer: 'A', claims }).success).toBe(false);
    expect(modelOutputSchema.safeParse({ answer: 5, claims, yesNo: 'yes' }).success).toBe(false);
  });
});

describe('toDraftResponse', () => {
  it('maps not_applicable to no yes/no value', () => {
    expect(toDraftResponse({ answer: 'A', claims, yesNo: 'not_applicable' })).toEqual({ answer: 'A', claims });
  });

  it('keeps yes and no', () => {
    expect(toDraftResponse({ answer: 'A', claims, yesNo: 'no' })).toEqual({ answer: 'A', claims, yesNo: 'no' });
  });
});

describe('draftResponseSchema', () => {
  it('accepts a response with or without yesNo and rejects anything else', () => {
    expect(draftResponseSchema.safeParse({ answer: 'A', claims }).success).toBe(true);
    expect(draftResponseSchema.safeParse({ answer: 'A', claims, yesNo: 'yes' }).success).toBe(true);
    expect(draftResponseSchema.safeParse({ answer: 'A', claims, yesNo: 'maybe' }).success).toBe(false);
    expect(draftResponseSchema.safeParse({ answer: 'A' }).success).toBe(false);
  });
});
