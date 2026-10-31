import { describe, it, expect } from 'vitest';
import { isStale } from './staleness';
import { NOW } from './test-helpers';

describe('isStale', () => {
  it('is fresh when reviewed exactly on the cutoff date', () => {
    expect(isStale('2025-10-31', NOW, 12)).toBe(false);
  });

  it('is stale one day before the cutoff', () => {
    expect(isStale('2025-10-30', NOW, 12)).toBe(true);
  });

  it('is fresh when reviewed recently', () => {
    expect(isStale('2026-09-01', NOW, 12)).toBe(false);
  });

  it('treats unparseable dates as stale', () => {
    expect(isStale('not-a-date', NOW, 12)).toBe(true);
  });

  it('honours a custom window', () => {
    expect(isStale('2026-06-30', NOW, 3)).toBe(true);
  });
});
