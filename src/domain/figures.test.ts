import { describe, it, expect } from 'vitest';
import { extractFigures } from './figures';

describe('extractFigures', () => {
  it('extracts plain numbers', () => {
    expect([...extractFigures('AES-256 with 3 keys')]).toEqual(['256', '3']);
  });

  it('keeps ISO dates as one token', () => {
    expect(extractFigures('Report dated 2025-03-31.').has('2025-03-31')).toBe(true);
  });

  it('keeps decimals as one token and drops trailing punctuation', () => {
    const figs = extractFigures('Uptime is 99.9, measured in 2025.');
    expect(figs.has('99.9')).toBe(true);
    expect(figs.has('2025')).toBe(true);
  });

  it('returns an empty set when there are no figures', () => {
    expect(extractFigures('No numbers here').size).toBe(0);
  });
});
