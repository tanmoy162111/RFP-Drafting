import type { Evidence } from './types';

/** Fixed "today" so staleness tests are deterministic. */
export const NOW = new Date('2026-10-31T00:00:00Z');

export function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    entryId: 'e1',
    sourceId: 's1',
    sourceStatus: 'approved',
    lastReviewedAt: '2026-06-01',
    text: 'We encrypt data at rest with AES-256.',
    score: 0.9,
    facts: [],
    ...overrides,
  };
}
